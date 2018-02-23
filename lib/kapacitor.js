/**
 * Created by Samparsky on 22/02/2018.
 */

const request = require('request-promise')

const username = process.env.INFLUX_USERNAME || "Hbyte"
const password = process.env.INFLUX_PASSWORD ||  "HrZXyfrZqD"
const host = process.env.KAPACITOR_URL || "calvinklein-1579bfa9.influxcloud.net:9092"

const ENDPOINT = `https://${username}:${password}@${host}`

const Kapacitor = {
    CreateTask: async(template_id, vars) => {
        const url = ENDPOINT+"/kapacitor/v1/tasks"

        const body = {
            "vars": vars,
            "template-id": template_id,
            "type": "stream",
            "status": "enabled",

        }

        request({
            url: url,
            method: "POST",
            json: JSON.stringify(body)
        }).then(function(response){
            console.log(response)
            return response
        }).catch(function(err){
            console.log(err)
            return null
        })

    },

    DeleteTask: async(task_id) => {
        const url = ENDPOINT+`/kapacitor/v1/tasks/${task_id}`

        request({
            url: url,
            method: 'DELETE'
        }).then(function(response){
            console.log(response)
            return response
        }).catch(function(err){
            console.log(err)
            return null
        })
    },
}

export default Kapacitor