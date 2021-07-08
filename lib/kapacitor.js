const request = require('request-promise');

const username = process.env.INFLUXDB_USERNAME || '';
const password = process.env.INFLUXDB_PASSWORD ||  '';
const host = process.env.KAPACITOR_URL || '';

const ENDPOINT = `https://${username}:${password}@${host}`;

const Kapacitor = {

    CreateTask: async(templateId, vars, db, rp) => {
        const url = ENDPOINT+'/kapacitor/v1/tasks';

        const body = {
            'vars': vars,
            'template-id': templateId,
            'type': 'stream',
            'status': 'enabled',
            'dbrps': [{"db": db, "rp" : rp}]
        }

      try {

        const result = await request({
          url: url,
          method: "POST",
          json: body
        })

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
          method: "PATCH",
          json: body
        })

        console.log('disabling task')
        console.log(result)
        return result

      } catch(err) {
        console.log(err)
      }
    }

}

export default Kapacitor
