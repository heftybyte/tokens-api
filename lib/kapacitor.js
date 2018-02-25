/**
 * Created by Samparsky on 22/02/2018.
 */

const request = require('request-promise')

const username = process.env.INFLUX_USERNAME || "Hbyte"
const password = process.env.INFLUX_PASSWORD ||  "HrZXyfrZqD"
const host = process.env.KAPACITOR_URL || "calvinklein-1579bfa9.influxcloud.net:9092"

const ENDPOINT = `https://${username}:${password}@${host}`

const Kapacitor = {

    CreateTask: async(template_id, vars, db, rp) => {
        const url = ENDPOINT+"/kapacitor/v1/tasks"

        const body = {
            "vars": vars,
            "template-id": template_id,
            "type": "stream",
            "status": "enabled",
            "dbrps": [{"db": db, "rp" : rp}]
        }

      try {

        const result = await request({
          url: url,
          method: "POST",
          json: body
        })

        console.log("sgsgagdadggasdgag")
        console.log(result)
        return result

      } catch(err) {
        console.log(err)
      }

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

    DisableTask: async(task_id) => {
      const url = ENDPOINT+`/kapacitor/v1/tasks/${task_id}`
      const body = {
        'status': 'disabled'
      }

      try {
        const result = await request({
          url: url,
          method: "POST",
          json: body
        })

        console.log("sgsgagdadggasdgag")
        console.log(result)
        return result

      } catch(err) {
        console.log(err)
      }
    }

}

export default Kapacitor
