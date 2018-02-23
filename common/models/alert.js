/**
 * Created by Samparsky on 22/02/2018.
 */

import Kapacitor from "../../lib/kapacitor";
import Expo from 'expo-server-sdk';
console.log({Expo}, Expo.isExpoPushToken)
const app = require('../../server/server');

module.exports = (Alert) => {

    const getAlertTemplateID = () => process.env.KAPACITOR_ALERT_TEMPLATE_ID;

    Alert.create = async (data, cb) => {

        let err = null

        const KapacitorAlert = app.default.Models.KapacitorAlert

        const findAlert = await KapacitorAlert.findOrCreate(
            {where: {fsym: data['fsym'],tsym: data['tsym'], price: data['price']}},
            {fsym: data['fsym'],tsym: data['tsym'], price: data['price']}
        ).catch(e=>err=e);

        if(err != null){
            cb(null, err)
        }

        console.log(findAlert)
        data.alertId = findAlert.id

        const result = await Alert.create(data).catch(e=>err=e)
        if (err){
            cb(err, null)
        }

        // create task on kapacitor
        const template_id = getAlertTemplateID()
        const vars = {
            "priceLevel": {value: data['price'], "type": "float"},
            "fsym": {value: data['fsym'], "type": "string"},
            "tsym": {value: data['tsym'], "type": "string"},
        }

        if(findAlert['task_id'] == ""){
            const task = await Kapacitor.CreateTask(template_id, vars)
            console.log(task)
            // update kapacitor alert with task_id

            if(result) {
                cb(null, result)
                return
            }
            cb(task, null)
            return
        }

        cb(null, {'data': result})
    }

    Alert.trigger = async(data, cb) => {
        // frequency=0 is once
        // frequency=1 is persistent

        console.log(data)
        let err = null
        const alertData = JSON.parse(data['data'])

        const fsym = alertData['data']['series'][0]['tags']['fsym']
        const tsym = alertData['data']['series'][0]['tags']['tsym']
        const price = alertData['data']['series'][0]['values'][0][1]

        const KapacitorAlert = app.default.Models.KapacitorAlert

        const result = await KapacitorAlert.findOne({
            where:{"fsym": fsym, "tsym": tsym, "price": price}
        }).catch(e=>err=e);

        Alert.find({where:{'alertId': result['id']}}, function(err, data){
            console.log(data)
            console.log(data[0].user.notification_tokens.toJSON())
            const messages = data
                .filter(item=>Expo.isExpoPushToken(item.user.notification_tokens.toJSON()))
                .map(item=>({
                    to: item.user.notification_tokens.toJSON(),
                    sound: 'default',
                    body: `Price Alert for token ${fsym}`,
                    data: {
                        fsym,
                        tsym,
                        price,
                        frequency: item['frequency'],
                        type: 'PRICE_ALERT'
                    }
                }))

            // console.log(data);

            let chunks = expo.chunkPushNotifications(messages);

            (async () => {
                for (let chunk of chunks) {
                    try {
                        let receipts = await expo.sendPushNotificationsAsync(chunk);
                        console.log(receipts);
                    } catch (error) {
                        console.error(error);
                    }
                }
            })();

            (async() => {
                data
                    .filter(item => item['frequency'] == 0)
                    .forEach((user) => {
                        Alert.remove({where: {userId: user['id']}}, function (err, result) {
                            if (err) {
                                console.log(err)
                            }
                            console.log(result)
                        })
                    })
            })()

            (async() => {
                const persistentAlerts = data.filter(item=>item['frequency']== 1)
                if(persistentAlerts.length == 0 ) {
                    // delete the task on kapacitor
                    KapacitorAlert.remove({where:{'id': result['id']}},function(err, alert){
                        Kapacitor.DeleteTask(result['task_id'])
                    })
                }
            })()
        })

    }


    Alert.remoteMethod('create', {
        http: {
            path: '/',
            verb: 'post'
        },
        accepts: [
            { arg: 'fsym', type: 'string', required: true },
            { arg: 'tsym', type: 'string', required: true },
            { arg: 'price', type: 'number', required: true },
            { arg: 'frequency', type: 'number', required: true, description: "0 is once , 1 is persistent" }
        ],
        description: 'Update User Notification token',
        returns: {arg: 'data', type: 'object'},
    })

    Alert.remoteMethod('trigger', {
        http: {
            path: '/trigger',
            verb: 'post'
        },
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'body' } }
        ],
        description: 'Alert Trigger URL',
    })

}