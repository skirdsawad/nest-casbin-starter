const portfinder = require('portfinder');
const { exec } = require('child_process');

portfinder.getPort((err, port) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

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
});
