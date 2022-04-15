import path from 'path'
import fastify from "fastify";
import fastifyStatic from 'fastify-static'

const server = fastify();

server.register(fastifyStatic, {
  root: path.join(process.cwd(), "public"),
  prefix: "/",
});

server.get("/", (request, reply) => {
  reply.status(200).sendFile('index.html');
});

server.listen(3000, () => console.info("Listening on http://localhost:3000"));
