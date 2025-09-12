const { exec } = require('child_process');

const port = 8000;
const command = `set PORT=${port} && react-scripts start`;
const child = exec(command);

child.stdout.on('data', (data) => {
  console.log(data);
});

child.stderr.on('data', (data) => {
  console.error(data);
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
