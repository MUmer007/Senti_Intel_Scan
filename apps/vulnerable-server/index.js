import http from 'node:http';

const port = 8080;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Content-Type', 'text/html');

  // Deliberately vulnerable to Reflected XSS
  if (url.pathname === '/search') {
    const query = url.searchParams.get('q') || '';
    res.statusCode = 200;
    res.end(`<html><body><h1>Search Results for: ${query}</h1><p>No results found.</p></body></html>`);
  } 
  // Deliberately vulnerable to SQL Injection Error Disclosure
  else if (url.pathname === '/login') {
    const user = url.searchParams.get('user') || 'guest';
    if (user.includes("'") || user.toUpperCase().includes("OR") || user.toUpperCase().includes("UNION")) {
      res.statusCode = 500;
      res.end(`<html><body><h1>Database Error</h1><p>You have an error in your SQL syntax near '${user}' at line 1</p></body></html>`);
    } else {
      res.statusCode = 200;
      res.end(`<html><body><h1>Welcome, ${user}</h1></body></html>`);
    }
  } else {
    res.statusCode = 404;
    res.end('<html><body><h1>404 Not Found</h1></body></html>');
  }
});

server.listen(port, () => {
  console.log(`🚀 Vulnerable server running at http://localhost:${port}`);
  console.log(`🎯 Test XSS: http://localhost:${port}/search?q=<script>alert(1)</script>`);
  console.log(`🎯 Test SQLi: http://localhost:${port}/login?user=admin' OR '1'='1`);
});
