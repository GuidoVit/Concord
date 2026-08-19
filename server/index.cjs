require('dotenv').config({
  path: require('path').join(__dirname, '.env')
})

const Fastify = require('fastify')

const app = Fastify({
  logger: true,
  bodyLimit: 150 * 1024 * 1024
})

app.addContentTypeParser(
  'application/octet-stream',
  { parseAs: 'buffer' },
  (_request, body, done) => done(null, body)
)

const cors = require('@fastify/cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const {
  AccessToken,
  RoomServiceClient
} = require('livekit-server-sdk')

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PORT =
  Number(
    process.env.PORT ||
    3333
  )

// ======================================================
// LIVEKIT
// ======================================================

const LIVEKIT_API_KEY =
  process.env.LIVEKIT_API_KEY || 'devkey'

const LIVEKIT_API_SECRET =
  process.env.LIVEKIT_API_SECRET || 'secret'

const LIVEKIT_URL =
  process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880'

const LIVEKIT_HTTP_URL =
  LIVEKIT_URL
    .replace(/^wss:/, 'https:')
    .replace(/^ws:/, 'http:')

const roomService =
  new RoomServiceClient(
    LIVEKIT_HTTP_URL,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET
  )

// Mantém o instante em que uma call passou de vazia para ativa.
// Se o backend reiniciar, o horário é reconstruído na primeira consulta.
const voiceSessionState =
  new Map()

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'concord-development-secret-change-this-later'

// ======================================================
// BANCO JSON
// ======================================================

const DATA_DIRECTORY =
  process.env.DATA_DIRECTORY ||
  path.join(
    __dirname,
    'data'
  )

const UPLOADS_DIRECTORY = path.join(
  DATA_DIRECTORY,
  'uploads'
)

const USERS_FILE = path.join(
  DATA_DIRECTORY,
  'users.json'
)

const FRIENDS_FILE = path.join(
  DATA_DIRECTORY,
  'friends.json'
)

const SERVERS_FILE = path.join(
  DATA_DIRECTORY,
  'servers.json'
)

const MESSAGES_FILE = path.join(
  DATA_DIRECTORY,
  'messages.json'
)

const SERVER_MESSAGES_FILE = path.join(
  DATA_DIRECTORY,
  'server-messages.json'
)

const SERVER_READ_STATE_FILE = path.join(
  DATA_DIRECTORY,
  'server-read-state.json'
)

function ensureFile(
  file,
  initialValue
) {
  if (!fs.existsSync(DATA_DIRECTORY)) {
    fs.mkdirSync(
      DATA_DIRECTORY,
      {
        recursive: true
      }
    )
  }

  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(
        initialValue,
        null,
        2
      ),
      'utf8'
    )
  }
}

function ensureDatabase() {
  if (!fs.existsSync(UPLOADS_DIRECTORY)) {
    fs.mkdirSync(UPLOADS_DIRECTORY, { recursive: true })
  }

  ensureFile(
    USERS_FILE,
    []
  )

  ensureFile(
    FRIENDS_FILE,
    []
  )

  ensureFile(
    SERVERS_FILE,
    []
  )

  ensureFile(
    MESSAGES_FILE,
    []
  )

  ensureFile(
    SERVER_MESSAGES_FILE,
    []
  )

  ensureFile(
    SERVER_READ_STATE_FILE,
    []
  )
}

function readJson(file) {
  ensureDatabase()

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    )
  } catch {
    return []
  }
}

function writeJson(
  file,
  data
) {
  fs.writeFileSync(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  )
}

function readUsers() {
  return readJson(
    USERS_FILE
  )
}

function readFriends() {
  return readJson(
    FRIENDS_FILE
  )
}

function readServers() {
  return readJson(
    SERVERS_FILE
  )
}

function readMessages() {
  return readJson(
    MESSAGES_FILE
  )
}

function readServerReadState() {
  return readJson(
    SERVER_READ_STATE_FILE
  )
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') {
    return null
  }

  const kind = String(attachment.kind || '')
  const dataUrl = String(attachment.dataUrl || '')
  const url = String(attachment.url || '')

  if (!['image', 'video', 'sticker'].includes(kind)) {
    return null
  }

  const hasLegacyData = dataUrl.startsWith('data:')
  const hasUploadedFile = /^\/uploads\/[a-zA-Z0-9._-]+$/.test(url)

  if (!hasLegacyData && !hasUploadedFile) {
    return null
  }

  if (hasLegacyData && dataUrl.length > 140_000_000) {
    return null
  }

  return {
    kind,
    ...(hasUploadedFile ? { url } : { dataUrl }),
    name: String(attachment.name || '').slice(0, 160),
    mimeType: String(attachment.mimeType || '').slice(0, 120),
    size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : undefined
  }
}

function markServerChannelRead(
  userId,
  serverId,
  channelId
) {
  const states =
    readServerReadState()

  const now =
    new Date()
      .toISOString()

  const existing =
    states.find(
      (item) =>
        item.userId ===
          userId &&
        item.serverId ===
          serverId &&
        item.channelId ===
          channelId
    )

  if (existing) {
    existing.lastReadAt =
      now
  } else {
    states.push({
      userId,
      serverId,
      channelId,
      lastReadAt: now
    })
  }

  writeJson(
    SERVER_READ_STATE_FILE,
    states
  )
}

function normalizeUsername(
  username
) {
  return String(
    username || ''
  )
    .trim()
    .toLowerCase()
}

function publicUser(user) {
  if (!user) {
    return null
  }

  return {
    id: user.id,

    username:
      user.username,

    displayName:
      user.displayName,

    createdAt:
      user.createdAt,

    avatarUrl:
      user.avatarUrl || ''
  }
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,

      username:
        user.username
    },

    JWT_SECRET,

    {
      expiresIn:
        '30d'
    }
  )
}

async function authenticate(
  request,
  reply
) {
  const authorization =
    request.headers
      .authorization

  if (!authorization) {
    return reply
      .code(401)
      .send({
        error:
          'Não autenticado.'
      })
  }

  const [
    type,
    token
  ] =
    authorization.split(
      ' '
    )

  if (
    type !== 'Bearer' ||
    !token
  ) {
    return reply
      .code(401)
      .send({
        error:
          'Token inválido.'
      })
  }

  try {
    request.user =
      jwt.verify(
        token,
        JWT_SECRET
      )
  } catch {
    return reply
      .code(401)
      .send({
        error:
          'Sua sessão expirou.'
      })
  }
}

function getUserById(id) {
  return readUsers()
    .find(
      (user) =>
        user.id === id
    )
}

function createInviteCode() {
  return crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()
}

function areFriends(
  firstId,
  secondId
) {
  return readFriends()
    .some(
      (item) =>
        item.status ===
          'accepted' &&
        (
          (
            item.senderId ===
              firstId &&
            item.receiverId ===
              secondId
          ) ||
          (
            item.senderId ===
              secondId &&
            item.receiverId ===
              firstId
          )
        )
    )
}

// ======================================================
// START
// ======================================================

async function start() {
  await app.register(
    cors,
    {
      origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ],

      methods: [
        'GET',
        'POST',
        'PATCH',
        'DELETE',
        'OPTIONS'
      ],

      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Harmony-File-Name',
        'X-Harmony-File-Type',
        'X-Harmony-File-Kind',
        'X-Concord-File-Name',
        'X-Concord-File-Type',
        'X-Concord-File-Kind'
      ]
    }
  )

  ensureDatabase()

  // ====================================================
  // HEALTH
  // ====================================================

  app.get(
    '/health',
    async () => ({
      ok: true,
      app: 'Harmony API'
    })
  )

  // ====================================================
  // UPLOADS DE MÍDIA
  // ====================================================

  app.post(
    '/uploads',
    { preHandler: authenticate },
    async (request, reply) => {
      const body = request.body

      if (!Buffer.isBuffer(body) || body.length === 0) {
        return reply.code(400).send({ error: 'Arquivo vazio.' })
      }

      if (body.length > 100 * 1024 * 1024) {
        return reply.code(413).send({ error: 'O arquivo deve ter no máximo 100 MB.' })
      }

      let originalName = 'arquivo'
      try {
        originalName = decodeURIComponent(String(request.headers['x-harmony-file-name'] || request.headers['x-concord-file-name'] || 'arquivo'))
      } catch {
        originalName = 'arquivo'
      }

      const mimeType = String(request.headers['x-harmony-file-type'] || request.headers['x-concord-file-type'] || 'application/octet-stream').slice(0, 120)
      const kind = String(request.headers['x-harmony-file-kind'] || request.headers['x-concord-file-kind'] || '')

      if (!['image', 'video', 'sticker'].includes(kind)) {
        return reply.code(400).send({ error: 'Tipo de anexo inválido.' })
      }

      if (kind === 'video' && !mimeType.startsWith('video/')) {
        return reply.code(400).send({ error: 'Formato de vídeo inválido.' })
      }

      if ((kind === 'image' || kind === 'sticker') && !mimeType.startsWith('image/')) {
        return reply.code(400).send({ error: 'Formato de imagem inválido.' })
      }

      const safeExtension = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12)
      const fileId = `${crypto.randomUUID()}${safeExtension}`
      const filePath = path.join(UPLOADS_DIRECTORY, fileId)
      const metaPath = `${filePath}.json`

      fs.writeFileSync(filePath, body)
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          name: originalName.slice(0, 160),
          mimeType,
          kind,
          size: body.length,
          uploadedBy: request.user.id,
          createdAt: new Date().toISOString()
        }, null, 2),
        'utf8'
      )

      return reply.code(201).send({
        attachment: {
          kind,
          url: `/uploads/${fileId}`,
          name: originalName.slice(0, 160),
          mimeType,
          size: body.length
        }
      })
    }
  )

  app.get(
    '/uploads/:fileId',
    async (request, reply) => {
      const fileId = String(request.params.fileId || '')

      if (!/^[a-f0-9-]{36}(?:\.[a-z0-9]{1,10})?$/i.test(fileId)) {
        return reply.code(404).send({ error: 'Arquivo não encontrado.' })
      }

      const filePath = path.join(UPLOADS_DIRECTORY, fileId)
      const metaPath = `${filePath}.json`

      if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) {
        return reply.code(404).send({ error: 'Arquivo não encontrado.' })
      }

      let meta = {}
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      } catch {
        meta = {}
      }

      const stat = fs.statSync(filePath)
      const total = stat.size
      const mimeType = String(meta.mimeType || 'application/octet-stream')
      const range = request.headers.range

      reply.header('Accept-Ranges', 'bytes')
      reply.header('Content-Type', mimeType)
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')

      if (!range) {
        reply.header('Content-Length', total)
        return reply.send(fs.createReadStream(filePath))
      }

      const match = /^bytes=(\d*)-(\d*)$/.exec(String(range))
      if (!match) {
        reply.header('Content-Range', `bytes */${total}`)
        return reply.code(416).send()
      }

      const start = match[1] ? Number(match[1]) : 0
      const requestedEnd = match[2] ? Number(match[2]) : total - 1
      const end = Math.min(requestedEnd, total - 1)

      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= total) {
        reply.header('Content-Range', `bytes */${total}`)
        return reply.code(416).send()
      }

      reply.code(206)
      reply.header('Content-Range', `bytes ${start}-${end}/${total}`)
      reply.header('Content-Length', end - start + 1)

      return reply.send(fs.createReadStream(filePath, { start, end }))
    }
  )

  // ====================================================
  // REGISTER
  // ====================================================

  app.post(
    '/auth/register',
    async (
      request,
      reply
    ) => {
      const {
        username,
        displayName,
        password
      } =
        request.body || {}

      if (
        !username ||
        !displayName ||
        !password
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Preencha todos os campos.'
          })
      }

      const normalizedUsername =
        normalizeUsername(
          username
        )

      if (
        normalizedUsername
          .length < 3
      ) {
        return reply
          .code(400)
          .send({
            error:
              'O usuário precisa ter pelo menos 3 caracteres.'
          })
      }

      if (
        normalizedUsername
          .length > 20
      ) {
        return reply
          .code(400)
          .send({
            error:
              'O usuário pode ter no máximo 20 caracteres.'
          })
      }

      if (
        !/^[a-z0-9_.]+$/.test(
          normalizedUsername
        )
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Use letras, números, _ ou .'
          })
      }

      if (
        password.length <
        6
      ) {
        return reply
          .code(400)
          .send({
            error:
              'A senha deve ter pelo menos 6 caracteres.'
          })
      }

      const users =
        readUsers()

      if (
        users.some(
          (item) =>
            item.username ===
            normalizedUsername
        )
      ) {
        return reply
          .code(409)
          .send({
            error:
              'Esse usuário já existe.'
          })
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        )

      const user = {
        id:
          crypto.randomUUID(),

        username:
          normalizedUsername,

        displayName:
          displayName
            .trim()
            .slice(
              0,
              32
            ),

        passwordHash,

        createdAt:
          new Date()
            .toISOString()
      }

      users.push(
        user
      )

      writeJson(
        USERS_FILE,
        users
      )

      return {
        token:
          generateToken(
            user
          ),

        user:
          publicUser(
            user
          )
      }
    }
  )

  // ====================================================
  // LOGIN
  // ====================================================

  app.post(
    '/auth/login',
    async (
      request,
      reply
    ) => {
      const {
        username,
        password
      } =
        request.body || {}

      const user =
        readUsers()
          .find(
            (item) =>
              item.username ===
              normalizeUsername(
                username
              )
          )

      if (!user) {
        return reply
          .code(401)
          .send({
            error:
              'Usuário ou senha incorretos.'
          })
      }

      const matches =
        await bcrypt.compare(
          password || '',
          user.passwordHash
        )

      if (!matches) {
        return reply
          .code(401)
          .send({
            error:
              'Usuário ou senha incorretos.'
          })
      }

      return {
        token:
          generateToken(
            user
          ),

        user:
          publicUser(
            user
          )
      }
    }
  )

  // ====================================================
  // CURRENT USER
  // ====================================================

  app.get(
    '/auth/me',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const user =
        getUserById(
          request.user.id
        )

      if (!user) {
        return reply
          .code(404)
          .send({
            error:
              'Usuário não encontrado.'
          })
      }

      return {
        user:
          publicUser(
            user
          )
      }
    }
  )

  // ====================================================
  // FRIENDS
  // ====================================================

  app.get(
    '/friends',
    {
      preHandler:
        authenticate
    },

    async (
      request
    ) => {
      const friendships =
        readFriends()

      const users =
        readUsers()

      const myId =
        request.user.id

      const accepted =
        friendships.filter(
          (item) =>
            item.status ===
              'accepted' &&
            (
              item.senderId ===
                myId ||
              item.receiverId ===
                myId
            )
        )

      const friends =
        accepted
          .map(
            (
              friendship
            ) => {
              const friendId =
                friendship
                  .senderId ===
                myId
                  ? friendship
                      .receiverId
                  : friendship
                      .senderId

              return users.find(
                (user) =>
                  user.id ===
                  friendId
              )
            }
          )
          .filter(Boolean)
          .map(
            publicUser
          )

      const incoming =
        friendships
          .filter(
            (item) =>
              item.receiverId ===
                myId &&
              item.status ===
                'pending'
          )
          .map(
            (item) => {
              const sender =
                users.find(
                  (user) =>
                    user.id ===
                    item.senderId
                )

              return {
                id:
                  item.id,

                user:
                  publicUser(
                    sender
                  )
              }
            }
          )

      return {
        friends,
        incoming
      }
    }
  )

  app.post(
    '/friends/request',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const {
        username
      } =
        request.body || {}

      const target =
        readUsers()
          .find(
            (user) =>
              user.username ===
              normalizeUsername(
                username
              )
          )

      if (!target) {
        return reply
          .code(404)
          .send({
            error:
              'Usuário não encontrado.'
          })
      }

      if (
        target.id ===
        request.user.id
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Você não pode adicionar você mesmo.'
          })
      }

      const friendships =
        readFriends()

      const existing =
        friendships.find(
          (item) =>
            (
              item.senderId ===
                request.user.id &&
              item.receiverId ===
                target.id
            ) ||
            (
              item.senderId ===
                target.id &&
              item.receiverId ===
                request.user.id
            )
        )

      if (existing) {
        return reply
          .code(409)
          .send({
            error:
              'Já existe um pedido ou amizade entre vocês.'
          })
      }

      friendships.push({
        id:
          crypto.randomUUID(),

        senderId:
          request.user.id,

        receiverId:
          target.id,

        status:
          'pending',

        createdAt:
          new Date()
            .toISOString()
      })

      writeJson(
        FRIENDS_FILE,
        friendships
      )

      return {
        ok: true
      }
    }
  )

  app.post(
    '/friends/:id/accept',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const friendships =
        readFriends()

      const item =
        friendships.find(
          (friendship) =>
            friendship.id ===
              request.params.id &&
            friendship
              .receiverId ===
              request.user.id
        )

      if (!item) {
        return reply
          .code(404)
          .send({
            error:
              'Pedido não encontrado.'
          })
      }

      item.status =
        'accepted'

      writeJson(
        FRIENDS_FILE,
        friendships
      )

      return {
        ok: true
      }
    }
  )

  app.delete(
    '/friends/:id',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      let friendships =
        readFriends()

      const relationship =
        friendships.find(
          (item) =>
            item.id ===
              request.params.id &&
            (
              item.senderId ===
                request.user.id ||
              item.receiverId ===
                request.user.id
            )
        )

      if (!relationship) {
        return reply
          .code(404)
          .send({
            error:
              'Pedido não encontrado.'
          })
      }

      friendships =
        friendships.filter(
          (item) =>
            item.id !==
            request.params.id
        )

      writeJson(
        FRIENDS_FILE,
        friendships
      )

      return {
        ok: true
      }
    }
  )

  // ====================================================
  // SERVERS
  // ====================================================

  app.get(
    '/servers',
    {
      preHandler:
        authenticate
    },

    async (
      request
    ) => ({
      servers:
        readServers()
          .filter(
            (server) =>
              (
                server.members ||
                []
              ).includes(
                request.user.id
              )
          )
          .map(
            (server) => ({
              ...server,

              channels:
                server.channels ||
                [
                  {
                    id:
                      crypto.randomUUID(),

                    name:
                      'Geral',

                    type:
                      'voice'
                  }
                ],

              memberRoles:
                server.memberRoles ||
                {
                  [server.ownerId]:
                    'owner'
                }
            })
          )
    })
  )

  app.post(
    '/servers',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const {
        name
      } =
        request.body || {}

      if (
        !name ||
        name.trim().length <
          2
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Digite um nome para o servidor.'
          })
      }

      const servers =
        readServers()

      let inviteCode =
        createInviteCode()

      while (
        servers.some(
          (server) =>
            server
              .inviteCode ===
            inviteCode
        )
      ) {
        inviteCode =
          createInviteCode()
      }

      const server = {
        id:
          crypto.randomUUID(),

        name:
          name
            .trim()
            .slice(
              0,
              40
            ),

        ownerId:
          request.user.id,

        inviteCode,

        members: [
          request.user.id
        ],

        memberRoles: {
          [request.user.id]:
            'owner'
        },

        iconUrl: '',

        channels: [
          {
            id:
              crypto.randomUUID(),

            name:
              'geral',

            type:
              'text'
          },

          {
            id:
              crypto.randomUUID(),

            name:
              'Geral',

            type:
              'voice'
          }
        ],

        createdAt:
          new Date()
            .toISOString()
      }

      servers.push(
        server
      )

      writeJson(
        SERVERS_FILE,
        servers
      )

      return {
        server
      }
    }
  )

  app.post(
    '/servers/join',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const {
        inviteCode
      } =
        request.body || {}

      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.inviteCode ===
            String(
              inviteCode ||
              ''
            )
              .trim()
              .toUpperCase()
        )

      if (!server) {
        return reply
          .code(404)
          .send({
            error:
              'Convite inválido.'
          })
      }

      if (
        !server.members
          .includes(
            request.user.id
          )
      ) {
        server.members.push(
          request.user.id
        )

        writeJson(
          SERVERS_FILE,
          servers
        )
      }

      return {
        server
      }
    }
  )

  // ====================================================
  // MENSAGENS DIRETAS
  // ====================================================

  app.get(
    '/messages',
    {
      preHandler:
        authenticate
    },

    async (
      request
    ) => {
      const myId =
        request.user.id

      const users =
        readUsers()

      const messages =
        readMessages()

      const friends =
        readFriends()
          .filter(
            (item) =>
              item.status ===
                'accepted' &&
              (
                item.senderId ===
                  myId ||
                item.receiverId ===
                  myId
              )
          )
          .map(
            (item) =>
              item.senderId ===
                myId
                ? item.receiverId
                : item.senderId
          )

      const conversations =
        friends
          .map(
            (friendId) => {
              const friend =
                users.find(
                  (item) =>
                    item.id ===
                    friendId
                )

              if (!friend) {
                return null
              }

              const conversationMessages =
                messages
                  .filter(
                    (message) =>
                      (
                        message
                          .senderId ===
                          myId &&
                        message
                          .receiverId ===
                          friendId
                      ) ||
                      (
                        message
                          .senderId ===
                          friendId &&
                        message
                          .receiverId ===
                          myId
                      )
                  )
                  .sort(
                    (a, b) =>
                      new Date(
                        a.createdAt
                      ) -
                      new Date(
                        b.createdAt
                      )
                  )

              const lastMessage =
                conversationMessages[
                  conversationMessages
                    .length - 1
                ] || null

              const unread =
                conversationMessages
                  .filter(
                    (message) =>
                      message
                        .receiverId ===
                        myId &&
                      !message.read
                  )
                  .length

              return {
                friend:
                  publicUser(
                    friend
                  ),

                lastMessage,
                unread
              }
            }
          )
          .filter(Boolean)
          .sort(
            (a, b) => {
              if (
                !a.lastMessage &&
                !b.lastMessage
              ) {
                return a.friend
                  .displayName
                  .localeCompare(
                    b.friend
                      .displayName
                  )
              }

              if (
                !a.lastMessage
              ) {
                return 1
              }

              if (
                !b.lastMessage
              ) {
                return -1
              }

              return (
                new Date(
                  b.lastMessage
                    .createdAt
                ) -
                new Date(
                  a.lastMessage
                    .createdAt
                )
              )
            }
          )

      return {
        conversations,

        unreadTotal:
          conversations
            .reduce(
              (
                total,
                conversation
              ) =>
                total +
                conversation
                  .unread,
              0
            )
      }
    }
  )

  app.get(
    '/messages/:friendId',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const myId =
        request.user.id

      const friendId =
        request.params
          .friendId

      if (
        !areFriends(
          myId,
          friendId
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Vocês precisam ser amigos para conversar.'
          })
      }

      const messages =
        readMessages()

      let changed =
        false

      for (
        const message
        of messages
      ) {
        if (
          message.senderId ===
            friendId &&
          message.receiverId ===
            myId &&
          !message.read
        ) {
          message.read =
            true

          changed =
            true
        }
      }

      if (changed) {
        writeJson(
          MESSAGES_FILE,
          messages
        )
      }

      return {
        messages:
          messages
            .filter(
              (message) =>
                (
                  message
                    .senderId ===
                    myId &&
                  message
                    .receiverId ===
                    friendId
                ) ||
                (
                  message
                    .senderId ===
                    friendId &&
                  message
                    .receiverId ===
                    myId
                )
            )
            .sort(
              (a, b) =>
                new Date(
                  a.createdAt
                ) -
                new Date(
                  b.createdAt
                )
            )
      }
    }
  )

  app.post(
    '/messages/:friendId',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const myId =
        request.user.id

      const friendId =
        request.params
          .friendId

      const content =
        String(
          request.body
            ?.content ||
          ''
        )
          .trim()

      const attachment =
        normalizeAttachment(
          request.body
            ?.attachment
        )

      if (
        !areFriends(
          myId,
          friendId
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Vocês precisam ser amigos para conversar.'
          })
      }

      if (
        !content &&
        !attachment
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Digite uma mensagem ou envie um arquivo.'
          })
      }

      if (
        content.length >
        2000
      ) {
        return reply
          .code(400)
          .send({
            error:
              'A mensagem é muito grande.'
          })
      }

      const target =
        getUserById(
          friendId
        )

      if (!target) {
        return reply
          .code(404)
          .send({
            error:
              'Usuário não encontrado.'
          })
      }

      const messages =
        readMessages()

      const message = {
        id:
          crypto.randomUUID(),

        senderId:
          myId,

        receiverId:
          friendId,

        content,
        attachment,

        read: false,

        createdAt:
          new Date()
            .toISOString()
      }

      messages.push(
        message
      )

      writeJson(
        MESSAGES_FILE,
        messages
      )

      return {
        message
      }
    }
  )

  // ====================================================
  // LIVEKIT
  // ====================================================

  app.post(
    '/livekit/token',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const {
        roomName
      } =
        request.body || {}

      if (
        !roomName ||
        typeof roomName !==
          'string'
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Sala de voz inválida.'
          })
      }

      const user =
        getUserById(
          request.user.id
        )

      if (!user) {
        return reply
          .code(404)
          .send({
            error:
              'Usuário não encontrado.'
          })
      }

      const accessToken =
        new AccessToken(
          LIVEKIT_API_KEY,
          LIVEKIT_API_SECRET,
          {
            identity:
              user.id,

            name:
              user.displayName,

            metadata:
              JSON.stringify({
                avatarUrl:
                  user.avatarUrl ||
                  '',

                username:
                  user.username ||
                  ''
              }),

            ttl:
              '2h'
          }
        )

      accessToken.addGrant({
        roomJoin: true,

        room:
          roomName,

        canPublish:
          true,

        canSubscribe:
          true,

        canPublishData:
          true,

        canUpdateOwnMetadata:
          true
      })

      return {
        token:
          await accessToken
            .toJwt(),

        url:
          LIVEKIT_URL
      }
    }
  )

  // ====================================================
  // PRESENÇA NOS CANAIS DE VOZ
  // ====================================================

  app.get(
    '/servers/:serverId/voice-presence',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const server =
        readServers()
          .find(
            (item) =>
              item.id ===
              request.params.serverId
          )

      if (
        !server ||
        !(
          server.members ||
          []
        ).includes(
          request.user.id
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Você não tem acesso a este servidor.'
          })
      }

      const voiceChannels =
        (
          server.channels ||
          []
        ).filter(
          (channel) =>
            channel.type ===
            'voice'
        )

      const presence = {}

      await Promise.all(
        voiceChannels.map(
          async (
            channel
          ) => {
            const roomName =
              `server-${server.id}-channel-${channel.id}`

            try {
              const participants =
                await roomService
                  .listParticipants(
                    roomName
                  )

              if (
                participants.length ===
                0
              ) {
                voiceSessionState
                  .delete(
                    roomName
                  )

                presence[
                  channel.id
                ] = {
                  participants: [],
                  startedAt: null
                }

                return
              }

              const currentParticipantIds =
                participants.map(
                  (participant) =>
                    participant.identity
                )

              let session =
                voiceSessionState
                  .get(
                    roomName
                  )

              const sameContinuousCall =
                Boolean(
                  session &&
                  Array.isArray(
                    session.participantIds
                  ) &&
                  session.participantIds.some(
                    (identity) =>
                      currentParticipantIds.includes(
                        identity
                      )
                  )
                )

              if (
                !session ||
                !sameContinuousCall
              ) {
                const joinedTimes =
                  participants
                    .map(
                      (participant) => {
                        const joinedAtMs =
                          Number(
                            participant.joinedAtMs ||
                            0
                          )

                        if (
                          Number.isFinite(
                            joinedAtMs
                          ) &&
                          joinedAtMs > 0
                        ) {
                          return joinedAtMs
                        }

                        const joinedAtSeconds =
                          Number(
                            participant.joinedAt ||
                            0
                          )

                        return (
                          Number.isFinite(
                            joinedAtSeconds
                          ) &&
                          joinedAtSeconds > 0
                        )
                          ? joinedAtSeconds * 1000
                          : Date.now()
                      }
                    )

                session = {
                  startedAt:
                    Math.min(
                      ...joinedTimes
                    ),

                  participantIds:
                    currentParticipantIds
                }
              } else {
                session = {
                  ...session,
                  participantIds:
                    currentParticipantIds
                }
              }

              voiceSessionState
                .set(
                  roomName,
                  session
                )

              presence[
                channel.id
              ] = {
                participants:
                  participants.map(
                    (
                      participant
                    ) => {
                      let metadata = {}

                      try {
                        metadata =
                          participant.metadata
                            ? JSON.parse(
                                participant.metadata
                              )
                            : {}
                      } catch {
                        metadata = {}
                      }

                      const storedUser =
                        getUserById(
                          participant.identity
                        )

                      const attributes =
                        participant.attributes ||
                        {}

                      return {
                        identity:
                          participant.identity,

                        name:
                          participant.name ||
                          storedUser?.displayName ||
                          participant.identity,

                        username:
                          metadata.username ||
                          storedUser?.username ||
                          '',

                        avatarUrl:
                          metadata.avatarUrl ||
                          storedUser?.avatarUrl ||
                          '',

                        isMuted:
                          attributes[
                            'harmony.muted'
                          ] ===
                          'true',

                        isDeafened:
                          attributes[
                            'harmony.deafened'
                          ] ===
                          'true'
                      }
                    }
                  ),

                startedAt:
                  new Date(
                    session.startedAt
                  ).toISOString()
              }
            } catch (
              error
            ) {
              voiceSessionState
                .delete(
                  roomName
                )

              presence[
                channel.id
              ] = {
                participants: [],
                startedAt: null
              }

              app.log.debug(
                {
                  roomName,
                  error:
                    error instanceof Error
                      ? error.message
                      : String(error)
                },
                'Harmony: sala de voz sem presença disponível.'
              )
            }
          }
        )
      )

      return {
        presence
      }
    }
  )

  // ====================================================
  // SERVIDOR DETALHADO
  // ====================================================

  app.get(
    '/servers/:serverId',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.id ===
            request.params
              .serverId
        )

      if (
        !server ||
        !(
          server.members ||
          []
        ).includes(
          request.user.id
        )
      ) {
        return reply
          .code(404)
          .send({
            error:
              'Servidor não encontrado.'
          })
      }

      server.channels =
        server.channels ||
        [
          {
            id:
              crypto.randomUUID(),

            name:
              'Geral',

            type:
              'voice'
          }
        ]

      server.memberRoles =
        server.memberRoles ||
        {
          [server.ownerId]:
            'owner'
        }

      const members =
        (
          server.members ||
          []
        )
          .map(
            (id) => {
              const member =
                publicUser(
                  getUserById(
                    id
                  )
                )

              if (!member) {
                return null
              }

              return {
                ...member,

                role:
                  id ===
                  server.ownerId
                    ? 'owner'
                    : (
                      server
                        .memberRoles[
                        id
                      ] ||
                      'member'
                    )
              }
            }
          )
          .filter(Boolean)

      return {
        server,
        members
      }
    }
  )

  app.patch(
    '/servers/:serverId',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.id ===
            request.params
              .serverId
        )

      if (!server) {
        return reply
          .code(404)
          .send({
            error:
              'Servidor não encontrado.'
          })
      }

      if (
        server.ownerId !==
        request.user.id
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Somente o dono pode alterar o servidor.'
          })
      }

      const {
        name,
        iconUrl
      } =
        request.body || {}

      if (
        typeof name ===
          'string' &&
        name.trim().length >=
          2
      ) {
        server.name =
          name
            .trim()
            .slice(
              0,
              40
            )
      }

      if (
        typeof iconUrl ===
        'string'
      ) {
        server.iconUrl =
          iconUrl.slice(
            0,
            1500000
          )
      }

      writeJson(
        SERVERS_FILE,
        servers
      )

      return {
        server
      }
    }
  )

  app.delete(
    '/servers/:serverId',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.id ===
            request.params
              .serverId
        )

      if (!server) {
        return reply
          .code(404)
          .send({
            error:
              'Servidor não encontrado.'
          })
      }

      if (
        server.ownerId !==
        request.user.id
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Somente o dono pode excluir o servidor.'
          })
      }

      writeJson(
        SERVERS_FILE,

        servers.filter(
          (item) =>
            item.id !==
            server.id
        )
      )

      const all =
        readJson(
          SERVER_MESSAGES_FILE
        )

      writeJson(
        SERVER_MESSAGES_FILE,

        all.filter(
          (message) =>
            message.serverId !==
            server.id
        )
      )

      const readStates =
        readServerReadState()

      writeJson(
        SERVER_READ_STATE_FILE,

        readStates.filter(
          (item) =>
            item.serverId !==
            server.id
        )
      )

      return {
        ok: true
      }
    }
  )

  // ====================================================
  // CANAIS
  // ====================================================

  app.post(
    '/servers/:serverId/channels',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.id ===
            request.params
              .serverId
        )

      if (!server) {
        return reply
          .code(404)
          .send({
            error:
              'Servidor não encontrado.'
          })
      }

      const role =
        request.user.id ===
        server.ownerId
          ? 'owner'
          : (
            server
              .memberRoles
              ?.[
                request.user.id
              ] ||
            'member'
          )

      if (
        ![
          'owner',
          'admin',
          'moderator'
        ].includes(
          role
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Você não pode criar canais.'
          })
      }

      const {
        name,
        type
      } =
        request.body || {}

      if (
        !name?.trim() ||
        ![
          'voice',
          'text'
        ].includes(
          type
        )
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Canal inválido.'
          })
      }

      server.channels =
        server.channels ||
        []

      const channel = {
        id:
          crypto.randomUUID(),

        name:
          name
            .trim()
            .slice(
              0,
              30
            ),

        type
      }

      server.channels.push(
        channel
      )

      writeJson(
        SERVERS_FILE,
        servers
      )

      return {
        server,
        channel
      }
    }
  )

  app.delete(
    '/servers/:serverId/channels/:channelId',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.id ===
            request.params
              .serverId
        )

      if (!server) {
        return reply
          .code(404)
          .send({
            error:
              'Servidor não encontrado.'
          })
      }

      const role =
        request.user.id ===
        server.ownerId
          ? 'owner'
          : (
            server
              .memberRoles
              ?.[
                request.user.id
              ] ||
            'member'
          )

      if (
        ![
          'owner',
          'admin',
          'moderator'
        ].includes(
          role
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Você não pode excluir canais.'
          })
      }

      server.channels =
        server.channels ||
        []

      const target =
        server.channels.find(
          (channel) =>
            channel.id ===
            request.params
              .channelId
        )

      if (
        target?.type ===
          'voice' &&
        server.channels
          .filter(
            (channel) =>
              channel.type ===
              'voice'
          )
          .length <=
          1
      ) {
        return reply
          .code(400)
          .send({
            error:
              'O servidor precisa ter ao menos um canal de voz.'
          })
      }

      server.channels =
        server.channels
          .filter(
            (channel) =>
              channel.id !==
              request.params
                .channelId
          )

      writeJson(
        SERVERS_FILE,
        servers
      )

      const all =
        readJson(
          SERVER_MESSAGES_FILE
        )

      writeJson(
        SERVER_MESSAGES_FILE,

        all.filter(
          (message) =>
            message.channelId !==
            request.params
              .channelId
        )
      )

      const readStates =
        readServerReadState()

      writeJson(
        SERVER_READ_STATE_FILE,

        readStates.filter(
          (item) =>
            item.channelId !==
            request.params
              .channelId
        )
      )

      return {
        server
      }
    }
  )

  // ====================================================
  // NÃO LIDAS
  // ====================================================

  app.get(
    '/servers/:serverId/unread',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const server =
        readServers()
          .find(
            (item) =>
              item.id ===
              request.params
                .serverId
          )

      if (
        !server ||
        !(
          server.members ||
          []
        ).includes(
          request.user.id
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Sem acesso.'
          })
      }

      const states =
        readServerReadState()

      const allMessages =
        readJson(
          SERVER_MESSAGES_FILE
        )

      const unread = {}

      for (
        const channel
        of (
          server.channels ||
          []
        ).filter(
          (item) =>
            item.type ===
            'text'
        )
      ) {
        const state =
          states.find(
            (item) =>
              item.userId ===
                request.user.id &&
              item.serverId ===
                server.id &&
              item.channelId ===
                channel.id
          )

        const lastReadAt =
          state?.lastReadAt
            ? new Date(
              state.lastReadAt
            ).getTime()
            : 0

        unread[
          channel.id
        ] =
          allMessages
            .filter(
              (message) =>
                message.serverId ===
                  server.id &&
                message.channelId ===
                  channel.id &&
                message.authorId !==
                  request.user.id &&
                new Date(
                  message.createdAt
                ).getTime() >
                  lastReadAt
            )
            .length
      }

      return {
        unread
      }
    }
  )

  // ====================================================
  // MENSAGENS DE SERVIDOR
  // ====================================================

  app.get(
    '/servers/:serverId/channels/:channelId/messages',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const server =
        readServers()
          .find(
            (item) =>
              item.id ===
              request.params
                .serverId
          )

      if (
        !server ||
        !(
          server.members ||
          []
        ).includes(
          request.user.id
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Sem acesso.'
          })
      }

      const messages =
        readJson(
          SERVER_MESSAGES_FILE
        )
          .filter(
            (message) =>
              message.serverId ===
                server.id &&
              message.channelId ===
                request.params
                  .channelId
          )
          .slice(-200)
          .map(
            (message) => ({
              ...message,

              author:
                publicUser(
                  getUserById(
                    message.authorId
                  )
                )
            })
          )

      markServerChannelRead(
        request.user.id,
        server.id,
        request.params
          .channelId
      )

      return {
        messages
      }
    }
  )

  app.post(
    '/servers/:serverId/channels/:channelId/messages',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const server =
        readServers()
          .find(
            (item) =>
              item.id ===
              request.params
                .serverId
          )

      if (
        !server ||
        !(
          server.members ||
          []
        ).includes(
          request.user.id
        )
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Sem acesso.'
          })
      }

      const channel =
        (
          server.channels ||
          []
        )
          .find(
            (item) =>
              item.id ===
                request.params
                  .channelId &&
              item.type ===
                'text'
          )

      if (!channel) {
        return reply
          .code(404)
          .send({
            error:
              'Canal de texto não encontrado.'
          })
      }

      const content =
        String(
          request.body
            ?.content ||
          ''
        )
          .trim()
          .slice(
            0,
            4000
          )

      const attachment =
        normalizeAttachment(
          request.body
            ?.attachment
        )

      if (
        !content &&
        !attachment
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Mensagem vazia.'
          })
      }

      const all =
        readJson(
          SERVER_MESSAGES_FILE
        )

      const message = {
        id:
          crypto.randomUUID(),

        serverId:
          server.id,

        channelId:
          channel.id,

        authorId:
          request.user.id,

        content,
        attachment,

        createdAt:
          new Date()
            .toISOString()
      }

      all.push(
        message
      )

      writeJson(
        SERVER_MESSAGES_FILE,
        all
      )

      markServerChannelRead(
        request.user.id,
        server.id,
        channel.id
      )

      return {
        message: {
          ...message,

          author:
            publicUser(
              getUserById(
                request.user.id
              )
            )
        }
      }
    }
  )

  // ====================================================
  // CARGOS
  // ====================================================

  app.patch(
    '/servers/:serverId/members/:memberId/role',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const servers =
        readServers()

      const server =
        servers.find(
          (item) =>
            item.id ===
            request.params
              .serverId
        )

      if (!server) {
        return reply
          .code(404)
          .send({
            error:
              'Servidor não encontrado.'
          })
      }

      if (
        server.ownerId !==
        request.user.id
      ) {
        return reply
          .code(403)
          .send({
            error:
              'Somente o dono gerencia cargos.'
          })
      }

      if (
        request.params
          .memberId ===
        server.ownerId
      ) {
        return reply
          .code(400)
          .send({
            error:
              'O cargo do dono não pode ser alterado.'
          })
      }

      const role =
        request.body
          ?.role

      if (
        ![
          'member',
          'moderator',
          'admin'
        ].includes(
          role
        )
      ) {
        return reply
          .code(400)
          .send({
            error:
              'Cargo inválido.'
          })
      }

      server.memberRoles =
        server.memberRoles ||
        {}

      server.memberRoles[
        request.params
          .memberId
      ] =
        role

      writeJson(
        SERVERS_FILE,
        servers
      )

      return {
        server
      }
    }
  )

  // ====================================================
  // PERFIL
  // ====================================================

  app.patch(
    '/profile',
    {
      preHandler:
        authenticate
    },

    async (
      request,
      reply
    ) => {
      const users =
        readUsers()

      const user =
        users.find(
          (item) =>
            item.id ===
            request.user.id
        )

      if (!user) {
        return reply
          .code(404)
          .send({
            error:
              'Usuário não encontrado.'
          })
      }

      const {
        username,
        displayName,
        avatarUrl
      } =
        request.body || {}

      if (
        typeof username ===
        'string'
      ) {
        const normalized =
          normalizeUsername(
            username
          )

        if (
          normalized.length <
          3
        ) {
          return reply
            .code(400)
            .send({
              error:
                'Nome de usuário muito curto.'
            })
        }

        if (
          users.some(
            (item) =>
              item.id !==
                user.id &&
              normalizeUsername(
                item.username
              ) ===
                normalized
          )
        ) {
          return reply
            .code(409)
            .send({
              error:
                'Nome de usuário já está em uso.'
            })
        }

        user.username =
          normalized
      }

      if (
        typeof displayName ===
          'string' &&
        displayName.trim()
      ) {
        user.displayName =
          displayName
            .trim()
            .slice(
              0,
              40
            )
      }

      if (
        typeof avatarUrl ===
        'string'
      ) {
        user.avatarUrl =
          avatarUrl.slice(
            0,
            1500000
          )
      }

      writeJson(
        USERS_FILE,
        users
      )

      return {
        user:
          publicUser(
            user
          )
      }
    }
  )

  // ====================================================
  // START SERVER
  // ====================================================

  try {
    await app.listen({
      port: PORT,
      host: '0.0.0.0'
    })

    console.log(
      `Harmony API rodando em http://127.0.0.1:${PORT}`
    )
  } catch (error) {
    app.log.error(
      error
    )

    process.exit(1)
  }
}

start()