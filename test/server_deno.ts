import { Hono } from 'https://deno.land/x/hono@v3.5.1/mod.ts'
import { sessionMiddleware as session, CookieStore, MemoryStore, Session } from '../mod.ts'
import { createKeyFromBase64 } from '../mod.ts'
import 'https://deno.land/std@0.198.0/dotenv/load.ts'
import { couldStartTrivia } from 'https://deno.land/x/ts_morph@18.0.0/common/typescript.js';
import { createTextChangeRange } from 'https://deno.land/x/ts_morph@18.0.0/common/typescript.js';

const app = new Hono()

const key = Deno.env.get('APP_KEY')
  ? await createKeyFromBase64(Deno.env.get('APP_KEY')) 
  : null

// const store = new CookieStore({
//   encryptionKey: key
// })

const store = new MemoryStore()

const session_routes = new Hono<{
  Variables: {
    session: Session,
    session_key_rotation: boolean
  }
}>()

session_routes.use('*', session({
  store, 
  encryptionKey: key,
  expireAfterSeconds: 30,
}))

session_routes.post('/login', async (c) => {
  const session = c.get('session')

  const { email, password } = await c.req.parseBody()

  if (password === 'correct') {
    c.set('session_key_rotation', true)
    session.set('email', email)
    session.set('failed-login-attempts', null)
    session.flash('message', 'Login Successful')
  } else {
    const failedLoginAttempts = (await session.get('failed-login-attempts') || 0) as number
    session.set('failed-login-attempts', failedLoginAttempts + 1)
    session.flash('error', 'Incorrect username or password')
  }

  return c.redirect('/')
})

session_routes.post('/logout', async (c) => {
  await c.get('session').deleteSession()
  return c.redirect('/')
})

session_routes.get('/', async (c) => {
  const session = c.get('session')

  const message = await session.get('message') || ''
  const error = await session.get('error') || ''
  const failedLoginAttempts = await session.get('failed-login-attempts')
  const email = await session.get('email')

  return c.html(`<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hono Sessions</title>
  </head>
  <body>
        <p>
            ${message}
        </p>
        <p>
            ${error}
        </p>
        <p>
            ${failedLoginAttempts ? `Failed login attempts: ${failedLoginAttempts}` : ''}
        </p>

        ${email ? 
        `<form id="logout" action="/logout" method="post">
            <button name="logout" type="submit">Log out ${email}</button>
        </form>`
        : 
        `<form id="login" action="/login" method="post">
            <p>
                <input id="email" name="email" type="text" placeholder="you@email.com">
            </p>
            <p>
                <input id="password" name="password" type="password" placeholder="password">
            </p>
            <button name="login" type="submit">Log in</button>
        </form>` 
    }
    </body>
  </html>`)
})

app.route('/', session_routes)

Deno.serve(app.fetch)