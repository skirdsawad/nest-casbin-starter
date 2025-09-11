import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';

function CreateUser({ open, handleClose, refreshUsers }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    // Fetch departments when component mounts
    fetch('http://localhost:3000/departments')
      .then(response => response.json())
      .then(data => setDepartments(data))
      .catch(error => console.error('Error fetching departments:', error));
  }, []);

  const handleCreate = () => {
    fetch('http://localhost:3000/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName, email, department, role }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to create user');
        }
        return response.json();
      })
      .then(() => {
        // Reset form
        setDisplayName('');
        setEmail('');
        setDepartment('');
        setRole('');
        refreshUsers();
        handleClose();
      })
      .catch((error) => console.error('Error creating user:', error));
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New User</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Enter the details for the new user including their department and role.
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
          required
        />
        <TextField
          margin="dense"
          label="Email Address"
          type="email"
          fullWidth
          variant="standard"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormControl fullWidth margin="dense" variant="standard" required>
          <InputLabel>Department</InputLabel>
          <Select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            label="Department"
          >
            {departments.map((dept) => (
              <MenuItem key={dept.code} value={dept.code}>
                {dept.name} ({dept.code})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="dense" variant="standard" required>
          <InputLabel>Role</InputLabel>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            label="Role"
          >
            <MenuItem value="STAFF">Staff</MenuItem>
            <MenuItem value="HD">Head of Department (HD)</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleCreate}
          disabled={!displayName || !email || !department || !role}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateUser;
