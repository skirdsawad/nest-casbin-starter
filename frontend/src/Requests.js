import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';

function Requests({ currentUserEmail, users }) {
  const [requests, setRequests] = useState([]);
  const [reviewableRequests, setReviewableRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [newRequestPayload, setNewRequestPayload] = useState('');

  const userMap = new Map(users.map((user) => [user.id, user.displayName]));
  const departmentMap = new Map(allDepartments.map((dept) => [dept.id, dept]));

  const combinedRequests = [...requests];
  const requestIds = new Set(requests.map((r) => r.id));
  for (const req of reviewableRequests) {
    if (!requestIds.has(req.id)) {
      combinedRequests.push(req);
    }
  }

  const fetchRequests = useCallback(
    (departmentId) => {
      if (!departmentId || !currentUserEmail) {
        setRequests([]);
        return;
      }
      fetch(`http://localhost:3000/requests?departmentId=${departmentId}`, {
        headers: {
          'x-user-email': currentUserEmail,
        },
      })
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => setRequests(Array.isArray(data) ? data : []))
        .catch((error) => {
          console.error('Error fetching requests:', error);
          setRequests([]);
        });
    },
    [currentUserEmail],
  );

  const fetchReviewableRequests = useCallback(() => {
    if (!currentUserEmail) {
      setReviewableRequests([]);
      return;
    }
    fetch(`http://localhost:3000/requests/reviewable`, {
      headers: {
        'x-user-email': currentUserEmail,
      },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setReviewableRequests(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('Error fetching reviewable requests:', error);
        setReviewableRequests([]);
      });
  }, [currentUserEmail]);

  useEffect(() => {
    if (currentUserEmail) {
      fetchReviewableRequests();

      // Fetch all departments for the department map
      fetch('http://localhost:3000/departments')
        .then((response) => response.json())
        .then((data) => setAllDepartments(data))
        .catch((error) => console.error('Error fetching all departments:', error));

      // Fetch creatable departments for the dropdown
      fetch('http://localhost:3000/departments/creatable', {
        headers: {
          'x-user-email': currentUserEmail,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setDepartments(data);
          if (data.length > 0) {
            const initialDept = data[0].id;
            setSelectedDepartment(initialDept);
            fetchRequests(initialDept);
          } else {
            setSelectedDepartment('');
            setRequests([]);
          }
        })
        .catch((error) => console.error('Error fetching creatable departments:', error));
    }
  }, [currentUserEmail, fetchRequests, fetchReviewableRequests]);

  const refreshAllData = () => {
    fetchRequests(selectedDepartment);
    fetchReviewableRequests();
  };

  const handleDepartmentChange = (event) => {
    setSelectedDepartment(event.target.value);
    fetchRequests(event.target.value);
  };

  const handleCreateRequest = () => {
    fetch('http://localhost:3000/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': currentUserEmail,
      },
      body: JSON.stringify({
        departmentId: selectedDepartment,
        payload: { content: newRequestPayload },
      }),
    })
      .then((response) => response.json())
      .then(() => {
        setNewRequestPayload('');
        refreshAllData();
      })
      .catch((error) => console.error('Error creating request:', error));
  };

  const handleSubmitRequest = (requestId) => {
    fetch(`http://localhost:3000/requests/${requestId}/submit`, {
      method: 'POST',
      headers: {
        'x-user-email': currentUserEmail,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Submit failed');
        return response.json();
      })
      .then(() => refreshAllData())
      .catch((error) => console.error('Error submitting request:', error));
  };

  const handleApprovalAction = (requestId, decision) => {
    fetch(`http://localhost:3000/requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': currentUserEmail,
      },
      body: JSON.stringify({ decision }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Approval action failed');
        return response.json();
      })
      .then(() => refreshAllData())
      .catch((error) => console.error('Error handling approval:', error));
  };

  const renderActions = (req) => {
    return req.permittedActions.map((action) => {
      if (action === 'submit') {
        return (
          <Button
            key="submit"
            variant="contained"
            size="small"
            onClick={() => handleSubmitRequest(req.id)}
            style={{ marginRight: '0.5rem' }}
          >
            Submit
          </Button>
        );
      }
      if (action === 'approve') {
        return (
          <Button
            key="approve"
            variant="contained"
            size="small"
            color="success"
            onClick={() => handleApprovalAction(req.id, 'approve')}
            style={{ marginRight: '0.5rem' }}
          >
            Approve
          </Button>
        );
      }
      if (action === 'reject') {
        return (
          <Button
            key="reject"
            variant="contained"
            size="small"
            color="error"
            onClick={() => handleApprovalAction(req.id, 'reject')}
          >
            Reject
          </Button>
        );
      }
      return null;
    });
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <Typography variant="h4" gutterBottom>
        Requests
      </Typography>

      {departments.length > 0 && (
        <>
          <FormControl fullWidth style={{ marginBottom: '1rem' }}>
            <InputLabel>Select Department</InputLabel>
            <Select value={selectedDepartment} onChange={handleDepartmentChange}>
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <div style={{ marginBottom: '1rem' }}>
            <TextField
              label="New Request Payload"
              value={newRequestPayload}
              onChange={(e) => setNewRequestPayload(e.target.value)}
              fullWidth
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreateRequest}
              style={{ marginTop: '0.5rem' }}
              disabled={!selectedDepartment}
            >
              Create Request
            </Button>
          </div>
        </>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Department</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Stage</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Payload</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {combinedRequests.map((req) => {
              const dept = departmentMap.get(req.departmentId);
              return (
                <TableRow key={req.id}>
                  <TableCell>{dept ? `${dept.name} (${dept.code})` : req.departmentId}</TableCell>
                  <TableCell>{req.status}</TableCell>
                  <TableCell>{req.stageCode}</TableCell>
                  <TableCell>{userMap.get(req.createdBy) || req.createdBy}</TableCell>
                  <TableCell>{req.payload?.content}</TableCell>
                  <TableCell>{renderActions(req)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default Requests;