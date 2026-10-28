import { defineConfig } from 'vite';
export default defineConfig({base:'./',build:{rolldownOptions:{output:{codeSplitting:{groups:[{name:'physics',test:/rapier3d/},{name:'three',test:/node_modules\/three/}]}}}}});
