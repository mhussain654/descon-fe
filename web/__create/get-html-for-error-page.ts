import { serializeError } from 'serialize-error';

export const getHTMLForErrorPage = (err: unknown): string => {
  const error = serializeError(err);
  return `
<html>
  <head>
    <script>
    window.onload = () => {
      console.error(${JSON.stringify(error)});
    }
    </script>
  </head>
  <body></body>
</html>
    `;
};
