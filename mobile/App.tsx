// IMPORTANT: This import MUST stay at the top level of the app entry point.
// expo-task-manager requires TaskManager.defineTask() to be called before
// any navigation or screen components are rendered.
import './src/services/backgroundTaskService';

import App from './src/App';
export default App;
