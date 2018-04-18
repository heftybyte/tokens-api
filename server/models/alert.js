import Kapacitor from "../../lib/kapacitor";
import Expo from 'expo-server-sdk';
console.log({Expo}, Expo.isExpoPushToken)
const app = require('../../server/server');
const uuidv4 = require('uuid/v4');
const ObjectID = require('mongodb').ObjectID


module.exports = (Alert) => {

  const getAlertTemplateID = (type) => type==0 ? process.env.KAPACITOR_GT_ALERT_TEMPLATE_ID : process.env.KAPACITOR_LS_ALERT_TEMPLATE_ID;

  const pushNotification = async (data, alert) => {

    let expo = new Expo()

    const Account = app.default.models.Account
    const result = await Promise.all(data.map((alert)=>( Account.findById(alert['userId']))))

    let notification_tokens = result.map((item)=>item.notification_tokens.toJSON())
    notification_tokens = [].concat(...notification_tokens)

    const messages = notification_tokens
      .filter(item => Expo.isExpoPushToken(item))
      .map(item => ({
        to: item,
        sound: 'default',
        body: alert['type'] == 0 ?
          `Price for token ${alert['fsym']} is greater than ${alert['price']}`:
          `Price for token ${alert['fsym']} is lesser than ${alert['price']}`,
        data: {
          fsym: alert['fsym'],
          tsym: alert['tsym'],
          price: alert['price'],
          frequency: alert['frequency'],
          type: 'PRICE_ALERT'
        }
     }))

    let chunks = expo.chunkPushNotifications(messages);

    for (let chunk of chunks) {
      try {
        let receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log(receipts);
      } catch (error) {
        console.error(error);
      }
    }
  }

  const disableAlertNotification = async(data) => {
    data
      .filter(item => item['frequency'] == 0)
      .forEach((user) => {
        Alert.updateAll({userId: new ObjectID(user['userId'])}, {'status': false}, function (err, result) {
          if (err) {
            console.log(err)
            return
          }
          console.log(result)
        })
      })
  }

  const disableKapacitorTask = async(data, kapacitorAlert) => {
    const KapacitorAlert = app.default.models.KapacitorAlert
    const persistentAlerts = data.filter(item => item['frequency'] == 1)
    if (persistentAlerts.length == 0) {
      // disable the task on kapacitor
      KapacitorAlert.updateAll({'id': kapacitorAlert['id']}, {'status': false}, function (err, alert) {
        Kapacitor.DisableTask(kapacitorAlert['task_id'])
      })
    }
  }


  Alert.fetchAll = async function(access_token, {fsym}=data, cb) {
    let err = null
    
    let userId = access_token.userId.toString()
    userId = new ObjectID(userId)
    
    const query = (fsym) ? {where: {fsym, userId}} : {where: {userId}}
    const result = await Alert.find(query).catch(e=>err=e)
    if(err){
      cb(err)
      return
    }

    cb(null, result)
  }

  Alert.disable = async function(accessToken, alertId, cb){
    let err = null

    let userId = accessToken.userId.toString()
    userId = new ObjectID(userId)
    alertId = new ObjectID(alertId)

    const result = await Alert.updateAll({ userId, id: alertId }, { status: false }).catch(e=>err=e)
    if(err){
      cb(err)
      return
    }
    cb(null, {'status':true, result})
  }

  Alert.enable = async function(accessToken, alertId, cb){
    let err = null
  
    let userId = accessToken.userId.toString()
    userId = new ObjectID(userId)
    alertId = new ObjectID(alertId)

    const result = await Alert.updateAll({userId, 'id': alertId }, { status: true }).catch(e=>err=e)
    if(err){
      cb(err)
      return
    }
    cb(null, {'status':true, result})
  }

  Alert.createAlert = async function (access_token, fsym, tsym, price, type, frequency, cb) {
    let err = null

    const KapacitorAlert = app.default.models.KapacitorAlert

    const findAlert = await KapacitorAlert.findOrCreate(
      {where: {fsym, tsym, price, type, 'status': true}},
      { fsym, tsym, price, type }
    ).catch(e => err = e);

    if (err != null) {
      console.log(err)
      cb(err, null)
      return err
    }

    const data = {
      fsym,
      tsym,
      price,
      frequency,
      type,
      "alertId": findAlert[0].id.toString(),
      "userId": access_token.userId.toString(),
    }

    const result = await Alert.create({fsym, tsym, price, frequency, "alert": data['alertId'], "userId": data['userId']})
      .catch(e => err = e)

    if (err) {
      cb(err, null)
      return err
    }

    // create task on kapacitor
    const template_id = getAlertTemplateID(type)

    const httpOutput = process.env.KAPACITOR_TRIGGER_URL ?
      process.env.KAPACITOR_TRIGGER_URL : 'localhost:3000/api/Alert/trigger'

    const script_id = uuidv4()

    const vars = {
      "priceLevel": {value: data['price'], "type": "float"},
      "fsym": {value: data['fsym'], "type": "string"},
      "tsym": {value: data['tsym'], "type": "string"},
      "idVar": {value: script_id, "type": "string"},
      "httpOutput": {value: httpOutput, "type": "string" }
    }

    if (!findAlert[0]['task_id']) {
      const task = await Kapacitor.CreateTask(template_id, vars, "prices", "autogen")
      // update kapacitor alert with task_id
      const alertUpdate = await KapacitorAlert.updateAll(
        {id: findAlert[0].id}, {'task_id': task['id'], 'script_id': script_id}).catch(e => err = e)
      if (err) {
        cb(err, null)
        return
      }
    }

    cb(null, {'data': {...data, id: result['id']}})
  }

  Alert.trigger = async(alertData, cb) => {
    // frequency=0 is once
    // frequency=1 is persistent
    let err = null

    const KapacitorAlert = app.default.models.KapacitorAlert

    const kAlert = await KapacitorAlert.findOne({
      where: {"script_id": alertData['id']}
    }).catch(e => err = e);

    const alertId = new ObjectID(kAlert['id'].toString())
    console.log(alertId)
    const query = { where: {"alert" : alertId, status:true }}
    const data = await Alert.find(query).catch(e=>err=e);
    console.log(data)

    await pushNotification(data, kAlert)
    await disableAlertNotification(data)
    await disableKapacitorTask(data, kAlert)
    cb(null, {'data': 'success'})

  }

  Alert.remoteMethod('createAlert', {
    http: {
      path: '/',
      verb: 'post'
    },
    accepts: [
      {
        arg: 'access_token', type: 'object', http: function (ctx) {
        let req = ctx && ctx.req;
        let accessToken = req && req.accessToken;
        return accessToken;
      }, description: 'Do not supply this argument, it is automatically extracted ' +
      'from request headers.',
      },
      {arg: 'fsym', type: 'string', required: true},
      {arg: 'tsym', type: 'string', required: true},
      {arg: 'price', type: 'number', required: true},
      {arg: 'type', type: 'number', required: true, description: "0 is greater than , 1 is less than"},
      {arg: 'frequency', type: 'number', required: true, description: "0 is once , 1 is persistent"}
    ],
    description: 'Update User Notification token',
    returns: {root: true},
  })

  Alert.remoteMethod('trigger', {
    http: {
      path: '/trigger',
      verb: 'post'
    },
    accepts: [
      {arg: 'data', type: 'object', http: {source: 'body'}}
    ],
    description: 'Alert Trigger URL',
    returns: {root: true},
  })

  Alert.remoteMethod('fetchAll', {
    http: {
      path: '/',
      verb: 'get'
    },
    accepts: [
      {
        arg: 'access_token', type: 'object', http: function (ctx) {
        let req = ctx && ctx.req;
        let accessToken = req && req.accessToken;
        return accessToken;
        }, description: 'Do not supply this argument, it is automatically extracted ' +
                        'from request headers.',
      },
      {arg: 'data', type: 'object', http: {source: 'body'}}
    ],
    description: 'Fetch User Alerts based on fsym',
    returns: {root: true},
  })

  Alert.remoteMethod('disable', {
    http: {
      path: '/disable/:id',
      verb: 'post'
    },
    accepts: [
      {
        arg: 'access_token', type: 'object', http: function (ctx) {
        let req = ctx && ctx.req;
        let accessToken = req && req.accessToken;
        return accessToken;
        }, description: 'Do not supply this argument, it is automatically extracted ' +
                        'from request headers.',
      },
      { arg: 'id', type: 'string', http: { source: 'path' }, description: 'Alert Id' }
    ],
    description: 'Disable User Alert',
    returns: {root: true},
  })

  Alert.remoteMethod('enable', {
    http: {
      path: '/enable/:id',
      verb: 'post'
    },
    accepts: [
      {
        arg: 'access_token', type: 'object', http: function (ctx) {
        let req = ctx && ctx.req;
        let accessToken = req && req.accessToken;
        return accessToken;
        }, description: 'Do not supply this argument, it is automatically extracted ' +
                        'from request headers.',
      },
      { arg: 'id', type: 'string', http: { source: 'path' }, description: 'Alert Id' }
    ],
    description: 'Enable User Alert',
    returns: {root: true},
  })

  Alert.disableRemoteMethodByName('get');
  Alert.disableRemoteMethodByName('create');


}
