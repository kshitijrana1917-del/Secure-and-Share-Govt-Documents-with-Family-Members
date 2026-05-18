FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install --production

# Bundle app source
COPY . .

# Ensure uploads directory exists and has correct permissions
RUN mkdir -p uploads && chown -R node:node uploads
RUN chown -R node:node /usr/src/app

# Bind to all network interfaces so that it can be mapped to the host OS
ENV HOST=0.0.0.0
ENV PORT=3000

# Use non-root user for security
USER node

EXPOSE 3000

CMD [ "npm", "start" ]
