import React, { useEffect, useState } from 'react';
import Button from './Button';
import { useAuth } from '../hooks/useAuth';
import { fetchUsers } from '../services/apiService';

export default function App() {
  const { user, isAuthenticated } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers().then(setUsers);
    }
  }, [isAuthenticated]);

  return (
    <div>
      <h1>Hello, {user?.name}</h1>
      <Button label="Refresh" onClick={() => fetchUsers().then(setUsers)} />
      <ul>
        {users.map(u => <li key={u.id}>{u.name}</li>)}
      </ul>
    </div>
  );
}
