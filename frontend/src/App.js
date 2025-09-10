import React, { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  CssBaseline,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Requests from './Requests';
import CreateUser from './CreateUser';

function App() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [showRequests, setShowRequests] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const fetchUsers = useCallback(() => {
    fetch('http://localhost:3000/users')
      .then((response) => response.json())
      .then((data) => {
        const sortedUsers = data.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(sortedUsers);
        if (sortedUsers.length > 0 && !selectedUser) {
          setSelectedUser(sortedUsers[0].email); // Default to the first user only if none is selected
        }
      })
      .catch((error) => console.error('Error fetching users:', error));
  }, [selectedUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Request Approval System
          </Typography>
          <FormControl style={{ minWidth: 200, backgroundColor: 'white', borderRadius: 4 }}>
            <InputLabel>Current User</InputLabel>
            <Select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.email}>
                  {user.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Toolbar>
      </AppBar>
      <Container style={{ marginTop: '2rem' }}>
        <Button
          variant="contained"
          onClick={() => setShowRequests(!showRequests)}
          style={{ marginBottom: '1rem', marginRight: '1rem' }}
        >
          {showRequests ? 'Hide Requests' : 'Show Requests'}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setCreateUserOpen(true)}
          style={{ marginBottom: '1rem' }}
        >
          Create User
        </Button>

        <CreateUser open={createUserOpen} handleClose={() => setCreateUserOpen(false)} refreshUsers={fetchUsers} />

        {showRequests ? (
          <Requests currentUserEmail={selectedUser} users={users} />
        ) : (
          <div>
            <Typography variant="h4" gutterBottom>
              Users
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Display Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Roles</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.roles.map((role) => (
                          <Chip
                            key={`${role.role}-${role.department}`}
                            label={`${role.role} (${role.department})`}
                            style={{ marginRight: '0.5rem' }}
                          />
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        )}
      </Container>
    </div>
  );
}

export default App;
