import process from 'node:process'
import express from 'express'

import w from '../lib/w.js'
import errorHandler from '../lib/error-handler.js'

import {createIndexes} from './indexes/index.js'
import search from './operations/search.js'
import reverse from './operations/reverse.js'
import autocomplete from './operations/autocomplete.js'
import {PARAMS, extractParams} from './params/base.js'
import {extractParams as extractAutocompleteParams} from './params/autocomplete.js'

const GEOCODE_INDEXES = process.env.GEOCODE_INDEXES
  ? process.env.GEOCODE_INDEXES.split(',')
  : ['address', 'poi', 'parcel']

export default function createRouter(options = {}) {
  const router = new express.Router()

  const indexes = createIndexes(options.indexes || GEOCODE_INDEXES)

  router.get('/search', w(async (req, res) => {
    const params = extractParams(req.query, {operation: 'search'}, PARAMS)
    const results = await search(params, {indexes})
    res.send({
      type: 'FeatureCollection',
      features: results
    })
  }))

  router.get('/reverse', w(async (req, res) => {
    const params = extractParams(req.query, {operation: 'reverse'})
    const results = await reverse(params, {indexes})
    res.send({
      type: 'FeatureCollection',
      features: results
    })
  }))

  router.get('/completion', w(async (req, res) => {
    const params = extractAutocompleteParams(req.query)
    const results = await autocomplete(params, {indexes})
    res.send({
      status: res.statusCode === 200 ? 'OK' : res.statusCode,
      results
    })
  }))

  router.use(errorHandler)

  return router
}
