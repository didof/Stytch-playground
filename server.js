import path from "path";
import fastify from "fastify";
import fastifyStatic from "fastify-static";
import fastifyCookie from "fastify-cookie";
import axios from "axios";
import { App } from "@octokit/app";
import { readFileSync } from "fs";
import jwt from "jsonwebtoken";

const server = fastify();

server.register(fastifyStatic, {
  root: path.join(process.cwd(), "public"),
  prefix: "/",
});

server.register(fastifyCookie, {
  secret: "secret",
});

server.get("/", (request, reply) => {
  reply.status(200).sendFile("index.html");
});

const api = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github.v3+json",
  },
});

const appId = 191439;
const privateKey = readFileSync(
  path.resolve(process.cwd(), "kelly-ghapp.2022-04-19.private-key.pem"),
  "utf8"
);

server.get("/oauth/github/login/success", async (request, reply) => {
  const stytch_token = request.query.token;

  let response;
  try {
    response = await axios.post(
      "https://test.stytch.com/v1/oauth/authenticate",
      {
        token: stytch_token,
        session_management_type: "idp",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        auth: {
          username: process.env.USERNAME,
          password: process.env.PASSWORD,
        },
      }
    );
  } catch (err) {
    console.error(err);
    return reply.status(500).send(err);
  }

  // to be used with normal GitHub REST API endpoints
  const { access_token } = response.data.session.idp;

  // https://github.community/t/getting-a-list-of-repos-with-my-github-bot-installed-on/14401

  // make JWT
  const now = Math.floor(Date.now() / 1000) - 60;
  const payload = jwt.sign(
    {
      iat: now - 60,
      exp: now + 10 * 60,
      iss: appId,
    },
    privateKey,
    {
      algorithm: "RS256",
    }
  );

  let installationsResponse;
  try {
    installationsResponse = await api.get(`/app/installations`, {
      headers: {
        Authorization: `Bearer ${payload}`,
      },
    });
  } catch (err) {
    console.error(err);
    return reply.status(500).send(err);
  }

  console.log(installationsResponse.data);

  const repositories = [];
  installationsResponse.data.forEach(async (installation) => {
    let accessTokenResponse;
    try {
      accessTokenResponse = await api.post(
        `/app/installations/${installation.id}/access_tokens`,
        null,
        {
          headers: {
            Authorization: `Bearer ${payload}`,
          },
        }
      );
    } catch (err) {
      console.error(err);
      return reply.status(500).send(err);
    }

    const token = accessTokenResponse.data.token;

    try {
      const installationRepositoriesResponse = await api.get(
        "/installation/repositories",
        {
          headers: {
            Authorization: `token ${token}`,
          },
        }
      );

      repositories.push(...installationRepositoriesResponse.data.repositories);

      // console.log(repositories);
    } catch (err) {
      console.error(err);
      return reply.status(500).send(err);
    }
  });

  return reply.status(200).sendFile("/github/login.html");
});

server.get("/oauth/github/signup/success", (request, reply) => {
  const { token } = request.query;

  console.log(token);

  reply
    .status(200)
    .setCookie("token", token, {
      domain: "dev.localhost.com",
      path: "/",
      httpOnly: true,
    })
    .sendFile("/github/signup.html");
});

server.get("/oauth/github/invite/success", (request, reply) => {
  const { token } = request.query;

  console.log(token);

  reply
    .status(200)
    .setCookie("token", token, {
      domain: "dev.localhost.com",
      path: "/",
      httpOnly: true,
    })
    .sendFile("/github/invite.html");
});

server.get("/session", (request, reply) => {
  const { token } = request.cookies;
  if (!token) {
    return reply.status(401).send({
      error: "No token",
    });
  }
});

server.listen(3000, () => console.info("Listening on http://localhost:3000"));
