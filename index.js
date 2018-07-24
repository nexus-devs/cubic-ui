const Core = require('cubic-core')
const API = require('cubic-api')
const local = require('./config/local.js')
const WebpackServer = require('./controllers/webpack.js')
const endpoints = require('./override/endpoints.js')
const Cookies = require('cookies')
const NativeMiddleware = require('cubic-api/middleware/native/express.js')

class Ui {
  constructor (options) {
    this.config = {
      local: local,
      provided: options || {}
    }
  }

  /**
   * Hook node components for actual logic
   */
  async init () {
    await cubic.use(new API(cubic.config.ui.api))
    await cubic.use(new Core(cubic.config.ui.core))

    // Attach access token from cookie to req
    if (!cubic.config.ui.api.disable) {
      cubic.nodes.ui.api.server.http.app.use((req, res, next) => {
        const cookies = new Cookies(req, res)
        const token = cookies.get(cubic.config.ui.client.accessTokenCookie)
        if (token && !req.headers.authorization) {
          req.access_token = token
          req.headers.authorization = `bearer ${token}`
        }
        next()
      })

      // Move cookie middleware to the beginning of the stack
      const middlewareStack = cubic.nodes.ui.api.server.http.app._router.stack
      middlewareStack.unshift(middlewareStack.pop())

      let middlewareAuth = middlewareStack.find((obj) => { return obj.name === 'bound auth' })

      // Construct new auth middleware
      const newNativeMiddleware = new NativeMiddleware(cubic.nodes.ui.api.server.config)

      // Replace old with new auth
      middlewareAuth.handle = newNativeMiddleware.auth.bind(newNativeMiddleware)
    }

    // Build webpack bundles
    if (!cubic.config.ui.core.disable) {
      const controller = cubic.nodes.ui.core.client.endpointController
      endpoints.override(controller)
      endpoints.rebuild(controller)
      cubic.nodes.ui.core.webpackServer = new WebpackServer()
    }
  }
}

module.exports = Ui
