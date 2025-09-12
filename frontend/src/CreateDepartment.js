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

function CreateDepartment({ open, handleClose, refreshDepartments }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    setError('');
    
    // Basic validation
    if (!code || !name) {
      setError('Both code and name are required');
      return;
    }
    
    if (code.length < 2 || code.length > 5) {
      setError('Code must be between 2 and 5 characters');
      return;
    }
    
    if (!/^[A-Z]+$/.test(code)) {
      setError('Code must contain only uppercase letters');
      return;
    }

    fetch('http://localhost:9000/departments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: code.toUpperCase(), name }),
    })
      .then((response) => {
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.message || 'Failed to create department');
          });
        }
        return response.json();
      })
      .then(() => {
        // Reset form
        setCode('');
        setName('');
        setError('');
        refreshDepartments();
        handleClose();
      })
      .catch((error) => {
        console.error('Error creating department:', error);
        setError(error.message || 'Failed to create department');
      });
  };

  const handleCodeChange = (e) => {
    // Convert to uppercase automatically
    setCode(e.target.value.toUpperCase());
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Department</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Enter the details for the new department. The code should be a short uppercase identifier.
        </DialogContentText>
        {error && (
          <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        <TextField
          autoFocus
          margin="dense"
          label="Department Code"
          type="text"
          fullWidth
          variant="standard"
          value={code}
          onChange={handleCodeChange}
          required
          helperText="2-5 uppercase letters (e.g., HR, IT, MKT)"
          inputProps={{ maxLength: 5 }}
        />
        <TextField
          margin="dense"
          label="Department Name"
          type="text"
          fullWidth
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          helperText="Full department name (e.g., Human Resources)"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleCreate}
          disabled={!code || !name}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateDepartment;