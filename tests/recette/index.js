/* eslint-disable complexity */
import 'dotenv/config.js'

import test from 'ava'
import process from 'node:process'
import path from 'node:path'
import {readFile} from 'node:fs/promises'
import got from 'got'
import yaml, {JSON_SCHEMA} from 'js-yaml'

const {RECETTE_API_URL} = process.env

if (!RECETTE_API_URL) {
  throw new Error('RECETTE_API_URL is required to run this script')
}

const requestsFilePath = path.resolve('./tests/recette/definition.yaml')
const requests = yaml.load(await readFile(requestsFilePath), {schema: JSON_SCHEMA})

function getResults(item, route) {
  const properties = item.properties || {}
  const result = {}

  if (route === '/search' || route === '/reverse') {
    result.id = properties?.extrafields?.cleabs || properties.id
    result.city = Array.isArray(properties.city) ? properties.city[0] : properties.city
    result.citycode = Array.isArray(properties.citycode) ? properties.citycode[0] : properties.citycode
    result.postcode = Array.isArray(properties.postcode) ? properties.postcode[0] : properties.postcode
    result.type = properties.type
    result.municipalitycode = properties.municipalitycode
    result.oldmunicipalitycode = properties.oldmunicipalitycode
    result.departmentcode = properties.departmentcode
    result.districtcode = properties.districtcode
    result.section = properties.section
    result.category = properties.category
    result.zipcode = properties.zipcode
    result.truegeometry = properties.truegeometry
    result.number = properties.number
    result.sheet = properties.sheet
    result._type = properties._type
    result.metropole = properties.metropole
  } else if (route === '/completion') {
    result.fulltext = item.fulltext
    result.city = item.city
    result.citycode = item.citycode
    result.postcode = item.postcode
    result.country = item.country
    result.zipcode = item.zipcode
    result.poiType = item.poiType
    result.metropole = item.metropole
  } else {
    Object.assign(result, item)
  }

  return result
}

for (const [route, routeRequests] of Object.entries(requests)) {
  for (const r of routeRequests) {
    const testFn = r.status === 'fail' ? test.skip : test
    testFn(`Test: ${route}${r.request}`, async t => {
      const url = RECETTE_API_URL + route + r.request

      if (r.results?.error?.code === 400) {
        return t.throwsAsync(() => got.get(url).json(), {message: 'Response code 400 (Bad Request)'})
      }

      const responses = await got.get(url).json()

      t.truthy(responses)

      const results = responses.error ? `Error: ${responses.error}` : (
        route === '/'
          ? [getResults(responses, route)]
          : responses[route === '/search' || route === '/reverse' ? 'features' : 'results'].map(item =>
            getResults(item, route)
          )
      )

      t.truthy(results)

      if (r.results.firstResult) {
        if (route === '/search' || route === '/reverse') {
          t.true(results[0]?.id === r.results.firstResult.id)
        } else if (route === '/completion') {
          t.true(results[0]?.fulltext === r.results.firstResult.fulltext)
        }
      }

      if (r.results.only) {
        const filters = Object.keys(r.results.only)

        for (const result of results) {
          for (const filter of filters) {
            if (Array.isArray(r.results.only[filter])) {
              t.deepEqual(result[filter], r.results.only[filter])
            } else {
              t.is(result[filter], r.results.only[filter])
            }
          }
        }
      }

      if (r.results.hasProperties) {
        const filters = r.results.hasProperties

        for (const result of results) {
          for (const filter of filters) {
            t.true(Object.keys(result).includes(filter))
          }
        }
      }

      if (r.results.many) {
        const filters = Object.keys(r.results.many)

        for (const result of results) {
          for (const filter of filters) {
            if (filter === 'terr') {
              const codeDepartement = result.zipcode && (result.zipcode < '97' ? result.zipcode.slice(0, 2) : result.zipcode.slice(0, 3))

              if (codeDepartement) {
                t.true(r.results.many[filter].includes(codeDepartement))
              }
            } else {
              t.true(r.results.many[filter].includes(result[filter]))
            }
          }
        }
      }

      if (r.results.including) {
        const filters = Object.keys(r.results.including)

        for (const result of results) {
          for (const filter of filters) {
            t.true(result[filter].includes(r.results.including[filter]))
          }
        }
      }

      if (r.results.nbResult) {
        t.is(results.length, r.results.nbResult)
      }
    })
  }
}
