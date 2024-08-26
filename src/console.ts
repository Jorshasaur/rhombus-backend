import * as repl from 'repl'

import { Server } from './server'
import { Document } from './models/Document'
import { DocumentRevision } from './models/DocumentRevision'
import { DocumentMembership } from './models/DocumentMembership'

let server = new Server()
let replServer = repl.start({ prompt: 'pages-api>> ' })
replServer.context.server = server
replServer.context.Document = Document
replServer.context.DocumentRevision = DocumentRevision
replServer.context.DocumentMembership = DocumentMembership
