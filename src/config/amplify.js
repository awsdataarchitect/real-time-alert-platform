import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

// Configure Amplify with the generated outputs
Amplify.configure(outputs);

export default outputs;