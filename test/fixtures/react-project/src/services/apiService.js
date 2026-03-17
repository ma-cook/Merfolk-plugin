const BASE_URL = 'https://api.example.com';

export async function fetchUsers() {
  const response = await fetch(`${BASE_URL}/users`);
  return response.json();
}

export async function createUser(userData) {
  const response = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  return response.json();
}
