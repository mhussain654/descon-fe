export const getHTMLForErrorPage = (requestId: string | undefined): string => {
  return `
<html>
  <head>
    <title>Something went wrong</title>
  </head>
  <body>
    <p>Something went wrong. Please try again.</p>
    ${requestId ? `<p>Reference: ${requestId}</p>` : ''}
  </body>
</html>
    `;
};
