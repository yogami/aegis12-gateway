FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install --prefix nextjs-demo
RUN npm run build --prefix nextjs-demo
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000
CMD ["npm", "start", "--prefix", "nextjs-demo"]
