const TZL_USD_EXPECTED_PRICE = 1 / 3 // 1 TZL = 0.33333333333333333 USD

const url_root = 'https://www.tzlibre.io'
const url_split = url_root + '/api/v1/split'
const url_whitelist = url_root + '/api/v1/whitelist'

const TIMEFORMAT = 'MMMM Do YYYY, h:mm a'

function is_empty (obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object
}

function reset () {
  app_data.loading = false
  app_data.error_handled = false
  whitelist_data.show = false
  whitelist_data.not_claimed = false
  split_data.show = false
  airdrops_data.show = false
  airdrops_data.rounds = []
  next_steps_data.show = false
  next_steps_data.show_bad_guy = false
  next_steps_data.show_good_fellow = false
  next_steps_data.show_whale = false
}

function start_loading () {
  app_data.loading = true
}

function stop_loading () {
  app_data.loading = false
}

function success_whitelist (wl_json) {
  if (is_empty(wl_json)) {
    return -1
  }

  if (wl_json.hasOwnProperty('ok') && !wl_json.ok) {
    error(wl_json)
    return -2 // leave handling to error fn
  }

  let amount = parseFloat(wl_json.h_TZL)

  whitelist_data.pkh = wl_json.pkh
  whitelist_data.h_TZL = wl_json.h_TZL
  whitelist_data.whitelist_time = moment(wl_json.whitelist_time).format(TIMEFORMAT).toString()
  whitelist_data.show = true

  return amount
}

function success_split (split_json) {
  if (is_empty(split_json)) {
    return false
  }

  if (split_json.hasOwnProperty('ok') && !split_json.ok) {
    error(split_json)
    return true // leave handling to error fn
  }

  split_data.eth_addr = split_json.eth_addr
  split_data.timestamp = moment(split_json.timestamp).format(TIMEFORMAT).toString()
  split_data.show = true

  // airdrops
  if (split_json.airdrops && split_json.airdrops.length) {
    airdrops_data.total_airdropped_amount = split_json.total_airdropped_amount
    airdrops_data.total_fee = split_json.total_fee
    airdrops_data.n_airdrops = split_json.n_airdrops
    airdrops_data.rounds = split_json.airdrops
    airdrops_data.show = true
  }

  // next_steps
  next_steps_data.show_bad_guy = !split_json.acc_declaration && !split_json.is_whale
  next_steps_data.show_good_fellow = split_json.acc_declaration && !split_json.is_whale
  next_steps_data.show_whale = split_json.is_whale
  next_steps_data.show = true

  return true
}

function success ([r_whitelist, r_split]) {
  let whitelisted_amount = success_whitelist(r_whitelist)
  let split = success_split(r_split)

  if (whitelisted_amount === -1 && !split) {
    showModal('modal-not-whitelisted')
    return
  }

  if (whitelisted_amount === 0 && !split) {
    showModal('modal-zero-owner')
    return
  }

  if (whitelisted_amount > 0 && !split) {
    whitelist_data.not_claimed = true
    showModal('modal-not-split')
    return
  }
}

function error (error_json) {
  if (app_data.error_handled) {
    return
  }

  if (error_json.code === 101) {
    showModal('modal-error-tzl-addr')
    return
  }

  if (error_json.code === 102) {
    showModal('modal-error-eth-addr')
    return
  }

  error_generic(error_json)
}

function error_generic (err) {
  reset()
  app_data.error_handled = true
  console.log('Something bad occurred :(')
  console.log(err)
  showModal('modal-error-generic')
}

function confirmed (airdrops) {
  return airdrops.filter(function (airdrop) {
    return airdrop.block_hash && airdrop.block_number
  })
}

function augment (airdrops) {
  return airdrops.map(function (airdrop) {
    airdrop.tx_fee_eth = airdrop.tx_fee * airdrop.eth_tzl_price
    airdrop.etherscan_link = `https://etherscan.io/tx/${airdrop.txid}`

    return airdrop
  })
}

async function get (url) {
  let response = await fetch(url)
  return response.json()
}

function get_whitelist (pkh) {
  let qs = `?pkh=${pkh}`
  let url = url_whitelist + qs
  return get(url)
}

function get_split (pkh) {
  let qs = `?tzl_pkh=${pkh}`
  let url = url_split + qs
  return get(url)
}

function verify () {
  reset()
  start_loading()

  let pkh = document.getElementById('verify-pkh').value
  let p_whitelist = get_whitelist(pkh).then(res => {
    if (res.hasOwnProperty('pkh') && res.pkh !== pkh) {
      error_generic(res)
    }
    return res
  })
  let p_split = get_split(pkh).then(res => {
    if (res.hasOwnProperty('tzl_pkh') && res.tzl_pkh !== pkh) {
      error_generic(res)
    }
    return res
  })

  Promise.all([p_whitelist, p_split])
    .then((args) => {
      success(args)
      stop_loading()
    })
    .catch((err) => {
      error_generic(err)
      stop_loading()
    })
}

// ///////////////////////// APPs //////////////////////////

let app_data = {
  loading: false,
  error_handled: false
}

let v_app = new Vue({
  el: '#verify-form',
  data: app_data
})

let whitelist_data = {
  show: false,
  pkh: '',
  h_TZL: '',
  whitelist_time: '',
  not_claimed: false
}

let v_whitelist = new Vue({
  el: '#verify-whitelist-box',
  data: whitelist_data
})

let split_data = {
  show: false,
  eth_addr: '',
  timestamp: ''
}

let v_split = new Vue({
  el: '#verify-split-box',
  data: split_data
})

let airdrops_data = {
  show: false,
  rounds: [],
  total_airdropped_amount: 0,
  total_fee: 0,
  n_airdrops: 0
}

let v_airdrops = new Vue({
  el: '#verify-airdrops-box',
  data: airdrops_data,
  methods: { augment, confirmed }
})

let next_steps_data = {
  show: false,
  show_bad_guy: false,
  show_good_fellow: false,
  show_whale: false
}

let v_next_steps = new Vue({
  el: '#verify-next-steps-box',
  data: next_steps_data
})
