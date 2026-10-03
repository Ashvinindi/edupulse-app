import React, { useState, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Upload, BookOpen, CheckCircle, Cpu, Loader2, Save, Bookmark, Trash2, ArrowLeft, Eye } from "lucide-react";
import MermaidDiagram from "./components/MermaidDiagram";

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState("analyzer"); // 'analyzer' or 'saved_notes'
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [savedNotes, setSavedNotes] = useState([]);
  const [selectedSavedNote, setSelectedSavedNote] = useState(null);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load Saved Notes on initial render
  useEffect(() => {
    fetchSavedNotes();
  }, []);

  const fetchSavedNotes = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/notes`);
      if (res.data.status === "success") {
        setSavedNotes(res.data.notes);
      }
    } catch (err) {
      console.error("Error fetching notes:", err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError("");
    setAnalysis(null);
    setSaveSuccess(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_BASE}/api/analyze_slide`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.status === "success") {
        setAnalysis({
          file_name: response.data.file_name || file.name,
          ...response.data.data,
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to analyze PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDB = async () => {
    if (!analysis) return;

    setSaving(true);
    try {
      const payload = {
        file_name: analysis.file_name || "Lecture Slide",
        summary: analysis.summary,
        key_points: analysis.key_points,
        mermaid_code: analysis.mermaid_code,
      };

      const res = await axios.post(`${API_BASE}/api/notes/save`, payload);
      if (res.data.status === "success") {
        setSaveSuccess(true);
        fetchSavedNotes(); // Refresh saved notes list
      }
    } catch (err) {
      alert("Failed to save note to Database.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation(); // Stop parent click event
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      await axios.delete(`${API_BASE}/api/notes/${id}`);
      fetchSavedNotes();
      if (selectedSavedNote?.id === id) {
        setSelectedSavedNote(null);
      }
    } catch (err) {
      alert("Failed to delete note.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6">
      {/* Header & Navigation */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">EduPulse AI</h1>
            <p className="text-xs text-slate-400">Smart Academic Slide Analyzer & Note Saver</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <button
            onClick={() => { setActiveTab("analyzer"); setSelectedSavedNote(null); }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "analyzer"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4" /> Slide Analyzer
          </button>
          <button
            onClick={() => setActiveTab("saved_notes")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === "saved_notes"
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bookmark className="w-4 h-4" /> Saved Notes Hub ({savedNotes.length})
          </button>
        </div>
      </header>

      {/* Dynamic Screen Content */}
      <main className="max-w-7xl mx-auto mt-8">
        {/* SCREEN 1: SLIDE ANALYZER */}
        {activeTab === "analyzer" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Column */}
            <div className="lg:col-span-1 space-y-6">
              {/* Upload Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-400" /> Upload Lecture
                </h2>

                <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 text-center transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label htmlFor="pdf-upload" className="cursor-pointer block">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                    <span className="text-xs font-medium text-slate-300 block truncate">
                      {file ? file.name : "Choose PDF Slide"}
                    </span>
                  </label>
                </div>

                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}

                <button
                  onClick={handleUpload}
                  disabled={loading || !file}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium py-2 px-3 text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze Slide"}
                </button>
              </div>

              {/* Saved Notes Sidebar Quick List */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-400" /> Saved Notes ({savedNotes.length})
                </h2>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {savedNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => setAnalysis(note)}
                      className="p-3 bg-slate-950 hover:bg-slate-800/60 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                    >
                      <p className="text-xs font-medium text-indigo-300 truncate">{note.file_name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{note.created_at}</p>
                    </div>
                  ))}
                  {savedNotes.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">No saved notes yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Analysis & Output Column */}
            <div className="lg:col-span-3 space-y-6">
              {analysis ? (
                <div className="space-y-6">
                  {/* Action Bar */}
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-slate-200">
                      📄 {analysis.file_name}
                    </h2>
                    <button
                      onClick={handleSaveToDB}
                      disabled={saving || saveSuccess}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-medium py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : saveSuccess ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" /> Saved to Neon DB
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" /> Save Note to DB
                        </>
                      )}
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold mb-3 text-indigo-400">📝 Smart Summary</h3>
                    <div className="prose prose-invert max-w-none text-slate-300 text-xs leading-relaxed">
                      <ReactMarkdown>{analysis.summary}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Mermaid Diagram */}
                  {analysis.mermaid_code && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                      <h3 className="text-sm font-semibold mb-3 text-indigo-400">📊 Process / Concept Flowchart</h3>
                      <MermaidDiagram code={analysis.mermaid_code} />
                    </div>
                  )}

                  {/* Key Exam Concepts */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold mb-3 text-indigo-400">🎯 Key Exam Concepts</h3>
                    <ul className="space-y-2">
                      {analysis.key_points?.map((point, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-2xl p-16 text-center text-slate-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Upload a slide deck or click a saved note from sidebar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 2: SAVED NOTES HUB */}
        {activeTab === "saved_notes" && (
          <div>
            {selectedSavedNote ? (
              /* Single Note Detailed Full Screen View */
              <div className="space-y-6">
                <button
                  onClick={() => setSelectedSavedNote(null)}
                  className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to All Saved Notes
                </button>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-slate-100 mb-1">📄 {selectedSavedNote.file_name}</h2>
                  <p className="text-xs text-slate-500">Saved on: {selectedSavedNote.created_at}</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-semibold mb-3 text-indigo-400">📝 Summary</h3>
                  <div className="prose prose-invert max-w-none text-slate-300 text-xs leading-relaxed">
                    <ReactMarkdown>{selectedSavedNote.summary}</ReactMarkdown>
                  </div>
                </div>

                {selectedSavedNote.mermaid_code && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-sm font-semibold mb-3 text-indigo-400">📊 Process Flowchart</h3>
                    <MermaidDiagram code={selectedSavedNote.mermaid_code} />
                  </div>
                )}

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-semibold mb-3 text-indigo-400">🎯 Key Concepts</h3>
                  <ul className="space-y-2">
                    {selectedSavedNote.key_points?.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              /* Saved Notes Grid View */
              <div>
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-indigo-400" /> Saved Notes Library
                </h2>

                {savedNotes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedNotes.map((note) => (
                      <div
                        key={note.id}
                        onClick={() => setSelectedSavedNote(note)}
                        className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-xl flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors truncate">
                              {note.file_name}
                            </h3>
                            <button
                              onClick={(e) => handleDeleteNote(note.id, e)}
                              className="text-slate-500 hover:text-red-400 p-1 rounded-lg transition-colors"
                              title="Delete Note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-3 mb-4">
                            {note.summary.replace(/[#*`]/g, "")}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-2 text-[11px] text-slate-500">
                          <span>{note.created_at}</span>
                          <span className="flex items-center gap-1 text-indigo-400 group-hover:underline">
                            <Eye className="w-3.5 h-3.5" /> View Note
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-900/40 border border-slate-800 border-dashed rounded-2xl p-16 text-center text-slate-500">
                    <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No saved notes found in database.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}