const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const databasePath = path.join(__dirname, 'covid19IndiaPortal.db')

const app = express()

app.use(express.json())

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error: ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_KEY', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// api 1
app.post('/login/', authenticateToken, async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
  select * from user where username = '${username}';
  `
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(401)
    response.send('Invalid user')
  } else {
    const checkPassword = await bcrypt.compare(password, dbUser.password)
    if (checkPassword === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_KEY')
      response.send({jwtToken})
    } else {
      response.status(401)
      response.send('Invalid password')
    }
  }
})

// api 2
app.get('/states/', authenticateToken, async (request, response) => {
  const getstates = `select * from state;`
  const getQuery = await db.all(getstates)
  response.send(getQuery)
})

// api 3
app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const selectedState = `select * from state where state_id = ${stateId};`
  const resultedQuery = await db.get(selectedState)
  response.send({
    stateId: resultedQuery.state_id,
    stateName: resultedQuery.state_name,
    population: resultedQuery.population,
  })
})

// api 4
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postQuery = `
    insert into district ( district_name, state_id, cases,cured, active, deaths)
    values (
      
     '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
    );
  `
  const output = await db.run(postQuery)
  response.send('District Successfully Added')
})

// api 5
app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectedState = `select * from district where district_id = ${districtId};`
    const resultedQuery = await db.get(selectedState)
    response.send({
      districtId: resultedQuery.district_id,
      districtName: resultedQuery.district_name,
      stateId: resultedQuery.state_id,
      cases: resultedQuery.cases,
      cured: resultedQuery.cured,
      active: resultedQuery.active,
      deaths: resultedQuery.deaths,
    })
  },
)

//api 6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
    delete from district
    where district_id = ${districtId};
      `
    await db.run(deleteQuery)
    response.send('District Removed')
  },
)

// api 7
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQuery = `
    update district
    set 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    where district_id = ${districtId};
  `
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

// api 8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStateById = `
    select 
      sum(cases) as totalCases,
      sum(cured) as totalCured,
      sum(active) as totalActive,
      sum(deaths) as totalDeaths
      from district
    where state_id = ${stateId};
  `
    const result = await db.get(getStateById)
    response.send(result)
  },
)

module.exports = app
