/** Local synthetic frontend integration only; never a production server. */
import {createServer} from 'vite';
import {startMockBusinessServer} from '../tests/fixtures/research-business-mock.mjs';
const fixture=await startMockBusinessServer();
process.env.VITE_RESEARCH_BUSINESS_MODE='mock';
let app;
try {app=await createServer({server:{host:'127.0.0.1',port:5185,strictPort:true,open:false,proxy:{'/__research_mock__':{target:fixture.url}}}});await app.listen();}
catch(error){await fixture.close();throw error;}
console.log('MOCK only: http://127.0.0.1:5185/#/research/work?mode=full');
console.log('Synthetic input only. Restart loses mock projects; use a new local test task. Normal builds stay unavailable.');
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await app.close();await fixture.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
