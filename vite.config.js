import { defineConfig } from 'vite';
import { createAlertMiddleware } from './server/api.js';
export default defineConfig({plugins:[{name:'official-alert-services',configureServer(server){server.middlewares.use(createAlertMiddleware())},configurePreviewServer(server){server.middlewares.use(createAlertMiddleware())}}]});
