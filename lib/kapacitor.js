/**
 * Created by Samparsky on 22/02/2018.
 */

const request = require('request-promise')

const username = process.env.INFLUX_USERNAME || "Hbyte"
const password = process.env.INFLUX_PASSWORD ||  "HrZXyfrZqD"
const host = process.env.KAPACITOR_URL || "calvinklein-1579bfa9.influxcloud.net:9092"

const ENDPOINT = `https://${username}:${password}@${host}`

export default Kapacitor = {
    CreateTask: async(template_id, vars) => {
        const url = ENDPOINT+"/kapacitor/v1/tasks"

        request({
            url: url,
            method: "POST",
            json: vars
        }).then(function(response){
            return response
        }).catch(function(err){
            console.log(err)
            return null
        })

    }
}