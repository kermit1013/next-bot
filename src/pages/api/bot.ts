import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { WebhookRequestBody } from '@line/bot-sdk';
import { Middleware } from '@line/bot-sdk/lib/middleware';
import * as line from '../../lib/line';

export const config = {
  api: {
    bodyParser: false, // Necessary for line.middleware
  },
};

async function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Middleware) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) =>
      result instanceof Error
        ? reject(result)
        : resolve(result)
    )
  });
}

const handler: NextApiHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  const url = "https://opendata.cwb.gov.tw/api/v1/rest/datastore/O-B0075-001?Authorization=rdec-key-123-45678-011121314";
  let resp = new Array();
  fetch(url).then(res => {
    return res.json();
  }).then(data => {
    let target = data.Records.SeaSurfaceObs.Location.find(function (el: { Station: { StationID: string; }; }) {
      return el.Station.StationID === '46694A'
    }
    );

    let target1 = target.StationObsTimes.StationObsTime.filter(function (el: { DateTime: string | number | Date; }) {
      const now = new Date();
      const past = new Date().setHours(now.getHours() - 5);
      return new Date(el.DateTime) <= new Date();
    }
    );


    target1.forEach((element: { WeatherElements: any; DateTime: any; }) => {
      let wave = element.WeatherElements
      let anemometer = wave.PrimaryAnemometer
      let text = ` DateTime: ${element.DateTime}
        WaveHeight: ${wave.WaveHeight} 
        WaveDirection: ${wave.WaveDirectionDescription} 
        WavePeriod: ${wave.WavePeriod}
        WindSpeed:  ${anemometer.WindSpeed}
        MaximumWindSpeed: ${anemometer.MaximumWindSpeed}
        WindDirection: ${anemometer.WindDirection}`
      console.log(text);
      resp.push(text)
    });

    // res.send(resp);
  })

  try {
    if (req.method === 'POST') {
      // Validate request
      await runMiddleware(req, res, line.middleware);

      // Handle events
      const body: WebhookRequestBody = req.body;
      await Promise.all(body.events.map(event => (async () => {
        if (event.mode === 'active') {
          switch (event.type) {
            case 'message': {
              const name = event.source.userId
                ? (await line.client.getProfile(event.source.userId)).displayName
                : 'User';
              await line.client.replyMessage(event.replyToken, {
                type: 'text',
                text: `${line.client.getMessageContent}!`
              });
              break;
            }
            case 'follow': {
              // Do something.
              break;
            }
          }
        }
      })()));
      res.status(200).end();
    } else {
      res.status(405).end();
    }
  } catch (e) {
    if (e instanceof Error) {
      res.status(500).json({ name: e.name, message: e.message });
    } else {
      res.status(500).end();
    }
  }
};

export default handler;