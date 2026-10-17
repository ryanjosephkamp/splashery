import {defineConfig} from "@playwright/test";
import config from "../../../playwright.config.mjs";
export default defineConfig({...config,testDir:new URL("./",import.meta.url).pathname,webServer:{...config.webServer,cwd:"/workspace/splashery",command:`node tools/cdx-mp2-server.mjs ${process.env.SPLASHERY_PORT||4188}`}});
