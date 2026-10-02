import {defineConfig} from 'vite';
import assets from './brand-assets.js';
const brand=()=>({name:'brand-assets',generateBundle(){for(const [fileName,b64] of Object.entries(assets))this.emitFile({type:'asset',fileName,source:Buffer.from(b64,'base64')});}});
export default defineConfig({base:'./',publicDir:false,plugins:[brand()]});
