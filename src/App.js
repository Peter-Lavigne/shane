import './App.css';
import { ComprehendClient, DetectSentimentCommand } from "@aws-sdk/client-comprehend";
import { useState } from 'react';
const { Configuration, OpenAIApi } = require("openai");

const openingLine = 'Shane has just arrived at the farm after a busy day at work.  He catches sight of you.';

const SENTIMENTS = {
  HAPPY: 1,
  PLEASED: 2,
  NEUTRAL: 3,
  ANNOYED: 4,
  CONCERNED: 5
}

const SENTIMENT_URLS = {
  [SENTIMENTS.HAPPY]: 'https://stardewvalleywiki.com/mediawiki/images/9/92/Shane_Happy.png',
  [SENTIMENTS.PLEASED]: 'https://stardewvalleywiki.com/mediawiki/images/f/ff/Shane_Pleased.png',
  [SENTIMENTS.NEUTRAL]: 'https://stardewvalleywiki.com/mediawiki/images/8/8b/Shane.png',
  [SENTIMENTS.ANNOYED]: 'https://stardewvalleywiki.com/mediawiki/images/c/c7/Shane_Annoyed.png',
  [SENTIMENTS.CONCERNED]: 'https://stardewvalleywiki.com/mediawiki/images/9/9d/Shane_Concerned.png',
}

const configuration = new Configuration({
  apiKey: '<<<Add OpenAi API key>>>'
});
const openai = new OpenAIApi(configuration);

const sentimentClient = new ComprehendClient({
  region: 'us-east-1',
  credentials: {
    accessKeyId: '<<<Add AWS key>>>',
    secretAccessKey: '<<<Add AWS secret KEY>>>'
  }
});

const getNextDialogue = async (prompt, suffix, n, max_tokens, model) => {
  const response = await openai.createCompletion({
    model: "text-davinci-002",
    prompt: prompt,
    temperature: 0.9,
    max_tokens: max_tokens,
    n: n,
    stop: [suffix, '\n'],
    suffix: suffix
  });
  return response;
}

const analyzeSentiment = async (text) => {
  const command = new DetectSentimentCommand({
    LanguageCode: 'en',
    Text: text
  });
  const response = await sentimentClient.send(command);
  return response;
}

// `story` should end with `Shane: ` without a newline
const getShaneDialogue = async (story, name) => {
  const response = await getNextDialogue(
    story,
    `\n${name}: `,
    1,
    100
  )
  let rawText = response.data.choices[0].text;
  while (rawText.length > 0 && rawText[0] === '\n') {
    rawText = rawText.substring(1);
  }
  return rawText.split(/\n/)[0];
}

// `story` should end with `${name}: ` without a newline
const getPlayerOptions = async (story) => {
  const optionsResponse = await getNextDialogue(
    story,
    `\nShane: `,
    2,
    20
  )
  return optionsResponse.data.choices.map(choice => choice.text.split(/\n/)[0]);
}

const say = async (name, story, phrase, setStory, setLastDialog, setOptions, setCustomOption, loading, setLoading, setSentiment, setStarted) => {
  if (loading) {
    return;
  }
  const sayNothing = '* say nothing *';
  if (phrase === sayNothing) {
    phrase = `* ${name} says nothing *`
  }
  setLoading(true);
  story = `${story}${phrase}\nShane: `;
  let dialogue = await getShaneDialogue(story, name);
  if (dialogue == '') {
    dialogue = '* Shane says nothing *';
  }
  const sentiment = await analyzeSentiment(dialogue);
  setLastDialog(dialogue);
  setSentiment(sentiment);
  setStarted(true);
  story = `${story}${dialogue}\n${name}: `
  let options = await getPlayerOptions(story);
  options = options.map(option => {
    if (option === '') {
      return sayNothing;
    }
    return option;
  })
  setStory(story);
  setOptions([...new Set(options)]);
  setCustomOption('');
  setLoading(false);
}

const start = async (name, setStory, setLastDialog, setOptions, setStarted, loading, setLoading, setSentiment) => {
  if (loading) {
    return;
  }
  const context = `* ${name} is a farmer who asks a lot of philosophical questions. Shane is a bartender in Pelican Town who is often rude and unhappy, and suffers from alcohol dependence. However, his attitude has started to improve toward ${name} as they become better friends. Shane enjoys telling stories about himself. Shane has just arrived at the farm after a busy day at work. He has a crazy story to tell ${name}. He catches sight of ${name}. *`;
  await say(name, `${context}\n`, '', setStory, setLastDialog, setOptions, () => { }, loading, setLoading, setSentiment, setStarted);
}

const getPortrait = (sentiment) => {
  if (sentiment === null) {
    return SENTIMENT_URLS[SENTIMENTS.NEUTRAL]
  }

  const positiveScore = sentiment.SentimentScore['Positive'];
  const negativeScore = sentiment.SentimentScore['Negative'];

  if (positiveScore < 0.2 && negativeScore < 0.2) {
    return SENTIMENT_URLS[SENTIMENTS.NEUTRAL];
  }

  if (positiveScore > 0.8 && negativeScore < 0.5) {
    return SENTIMENT_URLS[SENTIMENTS.HAPPY];
  }
  if (negativeScore > 0.8 && positiveScore < 0.5) {
    return SENTIMENT_URLS[SENTIMENTS.CONCERNED];
  }

  if (positiveScore - negativeScore > 0.1) {
    return SENTIMENT_URLS[SENTIMENTS.PLEASED];
  }
  if (negativeScore - positiveScore > 0.1) {
    return SENTIMENT_URLS[SENTIMENTS.PLEASED];
  }

  return SENTIMENT_URLS[SENTIMENTS.NEUTRAL];
}

function App() {
  const [story, setStory] = useState(null);
  const [lastDialog, setLastDialog] = useState(openingLine);
  const [started, setStarted] = useState(false);
  const [options, setOptions] = useState([]);
  const [customOption, setCustomOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentiment, setSentiment] = useState(null);
  const [name, setName] = useState('');

  return (
    <div className="App">
      <div className="flex-container">
        <img className='portrait' src={getPortrait(sentiment)} />
        <div className='dialogue-box-outer'>
          <div className='dialogue-box-inner'>
            {
              started ? (
                <p className='dialogue shane-dialogue'>{lastDialog}</p>
              ) : (
                <i className='dialogue'>{lastDialog}</i>
              )
            }
            <hr />
            {
              started ? (
                <>
                  {
                    options.map(option =>
                      <button
                        key={option}
                        className='dialogue dialogue-option'
                        disabled={loading}
                        onClick={() => say(name, story, option, setStory, setLastDialog, setOptions, setCustomOption, loading, setLoading, setSentiment, setStarted)}
                      >
                        {option}
                      </button>
                    )
                  }
                  <form className='dialog dialog-option' onSubmit={(e) => {
                    e.preventDefault();
                    say(name, story, customOption, setStory, setLastDialog, setOptions, setCustomOption, loading, setLoading, setSentiment, setStarted);
                  }}>
                    <input disabled={loading} placeholder={'Custom option'} className='dialog dialog-option custom-input' type="text" value={customOption} onInput={(e) => setCustomOption(e.target.value)} />
                  </form>
                  <hr />
                  <button
                    className='dialogue dialogue-option reset'
                    disabled={loading}
                    onClick={() => {
                      setStory(null);
                      setLastDialog(openingLine);
                      setStarted(false);
                      setOptions([]);
                      setCustomOption('');
                      setLoading(false);
                      setSentiment(null);
                    }}
                  >
                    Reset game
                  </button>
                </>
              ) : (
                <>
                  <form className='dialog dialog-option' onSubmit={(e) => {
                    e.preventDefault();
                    start(name, setStory, setLastDialog, setOptions, setStarted, loading, setLoading, setSentiment);
                  }}>
                    <input disabled={loading} placeholder={'What is your name?'} className='dialog dialog-option custom-input' type="text" value={name} onInput={(e) => setName(e.target.value)} />
                  </form>
                  <button
                    className='dialogue dialogue-option'
                    onClick={() => start(name, setStory, setLastDialog, setOptions, setStarted, loading, setLoading, setSentiment)}
                    disabled={loading || name === ''}
                  >
                    <i>Continue</i>
                  </button>
                </>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
