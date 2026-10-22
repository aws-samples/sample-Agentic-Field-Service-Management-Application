const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const AWS = require('aws-sdk');

// Configuration
const LAMBDA_FUNCTION_NAME = 'FSM-ReactAppServer';
const BUILD_DIR = path.join(__dirname, '..', 'build');
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const LAMBDA_PACKAGE_PATH = path.join(TEMP_DIR, 'lambda-package.zip');

// Ensure the temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Create a directory for the Lambda function code
const LAMBDA_CODE_DIR = path.join(TEMP_DIR, 'lambda-code');
if (fs.existsSync(LAMBDA_CODE_DIR)) {
  execSync(`rm -rf ${LAMBDA_CODE_DIR}`);
}
fs.mkdirSync(LAMBDA_CODE_DIR);

// Create the Lambda function handler
console.log('Creating Lambda function handler...');
const handlerCode = `
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Map of file paths to their content (will be populated at runtime)
const fileCache = {};

// Initialize the cache with the React build files
function initializeCache() {
  try {
    // Get all files in the build directory
    const buildDir = path.join(__dirname, 'build');
    const files = fs.readdirSync(buildDir, { recursive: true });
    
    // Cache each file
    files.forEach(file => {
      const filePath = path.join(buildDir, file);
      if (fs.statSync(filePath).isFile()) {
        const relativePath = path.relative(buildDir, filePath);
        const urlPath = '/' + relativePath.replace(/\\\\/g, '/');
        
        fileCache[urlPath] = {
          content: fs.readFileSync(filePath),
          contentType: mime.lookup(filePath) || 'application/octet-stream'
        };
      }
    });
    
    // Add a mapping for the root path to index.html
    if (fileCache['/index.html']) {
      fileCache['/'] = fileCache['/index.html'];
    }
    
    console.log('Cache initialized with', Object.keys(fileCache).length, 'files');
    console.log('Cached paths:', Object.keys(fileCache).slice(0, 10), '...');
  } catch (error) {
    console.error('Error initializing cache:', error);
  }
}

// Initialize the cache when the Lambda is first loaded
initializeCache();

exports.handler = async (event) => {
  console.log('Request event:', JSON.stringify(event));
  
  // Get the requested path
  let path = event.path || '/';
  
  // Remove the stage name if present (e.g., /prod/static/js/main.js -> /static/js/main.js)
  const stageName = event.requestContext && event.requestContext.stage;
  if (stageName && path.startsWith('/' + stageName)) {
    path = path.substring(stageName.length + 1);
  }
  
  // If path is empty or just '/', serve index.html
  if (path === '' || path === '/') {
    path = '/index.html';
  }
  
  console.log('Looking for path:', path);
  
  // Check if the file exists in our cache
  if (fileCache[path]) {
    console.log('Found in cache:', path, 'Content-Type:', fileCache[path].contentType);
    
    // For binary files (images, fonts, etc.), use base64 encoding
    const isBinary = !path.endsWith('.html') && 
                     !path.endsWith('.js') && 
                     !path.endsWith('.css') && 
                     !path.endsWith('.json') && 
                     !path.endsWith('.txt');
    
    if (isBinary) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': fileCache[path].contentType,
          'Cache-Control': 'max-age=300'
        },
        body: fileCache[path].content.toString('base64'),
        isBase64Encoded: true
      };
    } else {
      // For text files, return as UTF-8 string
      return {
        statusCode: 200,
        headers: {
          'Content-Type': fileCache[path].contentType,
          'Cache-Control': 'max-age=300'
        },
        body: fileCache[path].content.toString('utf-8'),
        isBase64Encoded: false
      };
    }
  }
  
  // For client-side routing, return the index.html for paths that don't match files
  // and don't look like static asset requests
  if (!path.includes('.')) {
    console.log('Serving index.html for client-side routing path:', path);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'max-age=0'
      },
      body: fileCache['/index.html'].content.toString('utf-8'),
      isBase64Encoded: false
    };
  }
  
  // File not found
  console.log('File not found:', path);
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'Not Found',
    isBase64Encoded: false
  };
};
`;

fs.writeFileSync(path.join(LAMBDA_CODE_DIR, 'index.js'), handlerCode);

// Create package.json for Lambda dependencies
console.log('Creating package.json...');
const packageJson = {
  name: 'fsm-react-app-lambda',
  version: '1.0.0',
  description: 'Lambda function to serve the FSM React app',
  main: 'index.js',
  dependencies: {
    'mime-types': '^2.1.35'
  }
};

fs.writeFileSync(
  path.join(LAMBDA_CODE_DIR, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Install dependencies
console.log('Installing dependencies...');
execSync('npm install', { cwd: LAMBDA_CODE_DIR });

// Create build directory in Lambda code directory
const LAMBDA_BUILD_DIR = path.join(LAMBDA_CODE_DIR, 'build');
if (!fs.existsSync(LAMBDA_BUILD_DIR)) {
  fs.mkdirSync(LAMBDA_BUILD_DIR, { recursive: true });
}

// Copy React build files to Lambda build directory
console.log('Copying React build files...');
execSync(`cp -r ${BUILD_DIR}/* ${LAMBDA_BUILD_DIR}`);

// Fix the paths in index.html
console.log('Fixing paths in index.html...');
const indexHtmlPath = path.join(LAMBDA_BUILD_DIR, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Update the paths to be relative instead of absolute
indexHtml = indexHtml.replace(/src="\/static\//g, 'src="static/');
indexHtml = indexHtml.replace(/href="\/static\//g, 'href="static/');

fs.writeFileSync(indexHtmlPath, indexHtml);

// List all files in the build directory to verify
console.log('Files in build directory:');
const listFiles = (dir, prefix = '') => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      listFiles(filePath, prefix + file + '/');
    } else {
      console.log(prefix + file);
    }
  });
};
listFiles(LAMBDA_BUILD_DIR);

// Create zip package
console.log('Creating Lambda package...');
execSync(`cd ${LAMBDA_CODE_DIR} && zip -r ${LAMBDA_PACKAGE_PATH} .`);

// Configure AWS SDK
const region = process.env.AWS_REGION || 'us-west-2';
AWS.config.update({ region });
const lambda = new AWS.Lambda();

// Update the Lambda function code
console.log(`Updating Lambda function ${LAMBDA_FUNCTION_NAME}...`);
lambda.updateFunctionCode({
  FunctionName: LAMBDA_FUNCTION_NAME,
  ZipFile: fs.readFileSync(LAMBDA_PACKAGE_PATH)
}, (err, data) => {
  if (err) {
    console.error('Error updating Lambda function:', err);
    process.exit(1);
  } else {
    console.log('Lambda function updated successfully:', data.FunctionArn);
    console.log('Deployment complete!');
  }
});
