FROM node:20
RUN apt-get update && apt-get install -y openssh-client
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g nodemon
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["nodemon", "index.js"]