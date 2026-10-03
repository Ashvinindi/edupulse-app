 # 1. Node.js Base Image
FROM node:20-alpine

# 2. Set Working Directory
WORKDIR /app

# 3. Package files copy කර dependencies install කිරීම
COPY package*.json ./
RUN npm install

# 4. To copy 
COPY . .

# 5. to Expose Vite Development Server  
EXPOSE 5173

# 6. to run the frontend
CMD ["npm", "run", "dev", "--", "--host"]