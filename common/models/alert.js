/**
 * Created by Samparsky on 22/02/2018.
 */
const app = require('../../server/server');
import Kapacitor from "../../lib/kapacitor";

module.exports = (Alert) => {

    const getAlertTemplateID = () => process.env.KAPACITOR_ALERT_TEMPLATE_ID;

    Alert.create = async (data, cb) => {
        let err = null

        const KapacitorAlert = app.default.Models.KapacitorAlert

        const findAlert = await KapacitorAlert.findOrCreate(
            {where: {fsym: data['fsym'],tsym: data['tsym'], price: data['price']}},
            {fsym: data['fsym'],tsym: data['tsym'], price: data['price'],frequency: data['frequency']}
        ).catch(e=>err=e);

        if(err != null){
            cb(null, err)
        }

        console.log(findAlert)
        data.alertId = findAlert.id
        const result = await PriceAlert.create(data).catch(e=>err=e)
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

        if(data['defined'] == false){
            const task = await Kapacitor.CreateTask(template_id, JSON.stringify(vars))
            if(result) {
                cb(null, result)
                return
            }
            cb(task, null)
            return
        }

        cb(null, result)
    }

    Alert.trigger = async(data, cb) => {
        let err = null
    }

}