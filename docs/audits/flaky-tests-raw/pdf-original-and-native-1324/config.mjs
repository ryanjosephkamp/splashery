import {defineConfig} from '@playwright/test';
import base from '../../../playwright.config.mjs';
export default defineConfig({...base,testDir:'.',testMatch:'probe.spec.mjs',outputDir:'results',workers:1,retries:0,reporter:[['list'],['json',{outputFile:'report.json'}]],use:{...base.use,trace:'on'},projects:[{name:'chromium',use:{browserName:'chromium'}}],webServer:{...base.webServer,cwd:'/workspace/splashery'}});
