# ProSIM website: the built React app (npm run build -> dist) served by nginx.
# Copy ../dist into this folder as dist before building the image.
FROM nginx:alpine
COPY dist /usr/share/nginx/html
EXPOSE 80
