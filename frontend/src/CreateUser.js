import React, { useState } from 'react';
import {
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

function CreateUser({ open, handleClose, refreshUsers }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  const handleCreate = () => {
    fetch('http://localhost:3000/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName, email }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create user');
        }
        return response.json();
      })
      .then(() => {
        refreshUsers();
        handleClose();
      })
      .catch((error) => console.error('Error creating user:', error));
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Create New User</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Enter the details for the new user. They will be assigned a default role.
        </DialogContentText>
        <TextField
          autoFocus
          margin="dense"
          label="Display Name"
          type="text"
          fullWidth
          variant="standard"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Email Address"
          type="email"
          fullWidth
          variant="standard"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleCreate}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateUser;
