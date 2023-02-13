import './App.css';
import { useEffect, useState } from 'react';
const { Configuration, OpenAIApi } = require("openai");

const PORTRAIT_URLS = {
  'NEUTRAL': "https://stardewvalleywiki.com/mediawiki/images/8/8b/Shane.png",
  'HAPPY': "https://stardewvalleywiki.com/mediawiki/images/9/92/Shane_Happy.png",
  'CONCERNED': "https://stardewvalleywiki.com/mediawiki/images/9/9d/Shane_Concerned.png",
  'NEUTRAL_DISTRACTED': "https://stardewvalleywiki.com/mediawiki/images/3/31/Shane_Neutral.png",
  'BLUSHING': "https://stardewvalleywiki.com/mediawiki/images/e/e1/Shane_Blushing.png",
  'ANNOYED': "https://stardewvalleywiki.com/mediawiki/images/c/c7/Shane_Annoyed.png",
  'SURPRISED': "https://stardewvalleywiki.com/mediawiki/images/d/d3/Shane_Surprised.png",
  'PLEASED': "https://stardewvalleywiki.com/mediawiki/images/f/ff/Shane_Pleased.png",
  'WITH_CHICKEN_HAPPY': "https://stardewvalleywiki.com/mediawiki/images/0/08/Shane_and_Charlie.png",
  'WITH_CHICKEN_CONCERNED': "https://stardewvalleywiki.com/mediawiki/images/5/55/Shane_and_Charlie_2.png",
  'FALLEN_DOWN_DRUNK': "https://stardewvalleywiki.com/mediawiki/images/e/eb/Shane_Fallen_Down.png",
  'BEACH_NEUTRAL': "https://stardewvalleywiki.com/mediawiki/images/f/f1/Shane_Beach.png",
  'BEACH_HAPPY': "https://stardewvalleywiki.com/mediawiki/images/d/d1/Shane_Beach_Happy.png",
  'BEACH_CONCERNED': "https://stardewvalleywiki.com/mediawiki/images/2/25/Shane_Beach_Concerned.png",
}

const OPENING_LINE = 'Shane has just arrived at the farm after a busy day at work. He catches sight of you.';

const openingScene = (name) => {
  return `* ${name} is a farmer who asks the most important questions. Shane is a bartender in Pelican Town who is often rude and unhappy, and suffers from alcohol dependence. However, his attitude has started to improve toward ${name} as they become better friends. Shane enjoys telling stories about himself. Shane has just arrived at the farm after a busy day at work. He has a crazy story to tell ${name}. He catches sight of ${name}. *`;
}

const MIN_PLAYER_CHOICES = 2;
const MAX_PLAYER_CHOICES = 3;

const SAY_NOTHING_OPTION = "* Say nothing. *";
const sayNothingDialogue = (name) => {
  return `* ${name} says nothing. *`;
}

let story = null;

function App() {
  const [mostRecentShaneDialogue, setMostRecentShaneDialogue] = useState(null);
  // [string, string] containing the player's option and Shane's response
  const [optionsWithResponses, setOptionsWithResponses] = useState(null);
  const [customOption, setCustomOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentimentUrl, setSentimentUrl] = useState(PORTRAIT_URLS['NEUTRAL']);
  const [name, setName] = useState('');
  const [openAIClient, setOpenAIClient] = useState(null);

  const onClickReset = () => {
    story = null;
    setMostRecentShaneDialogue(null);
    setOptionsWithResponses(null);
    setCustomOption('');
    setLoading(false);
    setSentimentUrl(PORTRAIT_URLS['NEUTRAL'])
  }

  const createCompletion = async (
    prompt,
    num_responses,
    max_generated_tokens,
    stop = null,
  ) => {
    const response = await openAIClient.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      temperature: 0.9,
      max_tokens: max_generated_tokens,
      n: num_responses,
      stop: stop ? [stop] : undefined,
      suffix: stop
    });
    return response;
  }

  const detectSentimentUrl = async (text) => {
    const options = Object.keys(PORTRAIT_URLS).join(', ');
    const prompt = `Classify the following phrase as one of the following: ${options}\n${text}\n`;
    const response = await createCompletion(prompt, 1, 15);
    const responseText = response.data.choices[0].text.trim();
    if (Object.keys(PORTRAIT_URLS).includes(responseText)) {
      return PORTRAIT_URLS[responseText];
    } else {
      return PORTRAIT_URLS['NEUTRAL'];
    }
  }

  // `story` should end with `Shane: ` without a newline
  const getShaneDialogue = async () => {
    const response = await createCompletion(
      story,
      1,
      100,
      `\n${name}: `,
    )
    let rawText = response.data.choices[0].text.trim();
    const processedText = rawText.split(/\n/)[0];
    if (processedText === '') {
      return sayNothingDialogue(name);
    } else {
      return processedText;
    }
  }

  // `story` should end with `${name}: ` without a newline
  const getPlayerOptionsWithShaneResponses = async () => {
    const optionsResponse = await createCompletion(
      story,
      MAX_PLAYER_CHOICES,
      120,
      `\n${name}: `,
    )
    const shaneLineStart = `Shane: `;
    const choices = optionsResponse.data.choices
      .map(choice => choice.text.split(/\n/).filter(line => line !== ''))
      .filter(lines => lines.length > 0)
      .map(lines => {
        if (lines.length > 1 && lines[1].startsWith(shaneLineStart)) {
          return [
            lines[0],
            lines[1].substring(shaneLineStart.length)
          ];
        } else {
          return [lines[0], null];
        }
      })
    const uniqueChoices = choices.filter((choice, index) => {
      return choices.findIndex((otherChoice) => {
        return otherChoice[0] === choice[0];
      }) === index;
    });
    if (uniqueChoices.length < MIN_PLAYER_CHOICES) {
      uniqueChoices.push([SAY_NOTHING_OPTION, null])
    }
    return uniqueChoices;
  }

  const immediatelyProcessShaneDialogue = async (dialogue) => {
    const sentimentUrl = await detectSentimentUrl(dialogue);
    setMostRecentShaneDialogue(dialogue);
    setSentimentUrl(sentimentUrl);
  }

  const processPlayerDialogue = async (dialogue, shane_response = null) => {
    if (loading) return;
    setLoading(true);
    if (dialogue === SAY_NOTHING_OPTION) {
      dialogue = sayNothingDialogue(name);
    }
    story = `${story}${dialogue}\nShane: `;
    if (shane_response === null) {
      shane_response = await getShaneDialogue();
    }
    story = `${story}${shane_response}\n${name}: `;
    const [_, options] = await Promise.all([
      immediatelyProcessShaneDialogue(shane_response),
      getPlayerOptionsWithShaneResponses()
    ]);
    setOptionsWithResponses(options);
    setCustomOption('');
    setLoading(false);
  }

  const onStart = async () => {
    if (loading) return;
    setLoading(true);
    story = `${openingScene(name)}\n\nShane: `;
    const shane_response = await getShaneDialogue();
    story = `${story}${shane_response}\n${name}: `;
    const [sentimentUrl, options] = await Promise.all([
      detectSentimentUrl(shane_response),
      getPlayerOptionsWithShaneResponses(),
    ]);
    setMostRecentShaneDialogue(shane_response);
    setSentimentUrl(sentimentUrl);
    setOptionsWithResponses(options);
    setLoading(false);
  }

  const onSubmitPredefinedOption = (option) => {
    processPlayerDialogue(option[0], option[1]);
  }

  const onSubmitCustomOption = () => {
    processPlayerDialogue(customOption);
  }

  const createOpenAIApiClient = (apiKey) => {
    const configuration = new Configuration({
      apiKey: apiKey
    });
    setOpenAIClient(new OpenAIApi(configuration));
  }

  useEffect(() => {
    if (process.env.REACT_APP_OPENAI_KEY !== undefined) {
      createOpenAIApiClient(process.env.REACT_APP_OPENAI_KEY);
    }
  }, []);

  return (
    <div className="App">
      <div className="flex-container">
        <img className='portrait' src={sentimentUrl} />
        <div className='dialogue-box-outer'>
          <div className='dialogue-box-inner'>
            {
              openAIClient ? (
                <>
                  {
                    mostRecentShaneDialogue === null ? (
                      <i className='dialogue'>{OPENING_LINE}</i>
                    ) : (
                      <p className='dialogue shane-dialogue'>{mostRecentShaneDialogue}</p>
                    )
                  }
                  <hr />
                  {
                    (optionsWithResponses === null) ? (
                      <>
                        <form className='dialog dialog-option' onSubmit={(e) => {
                          e.preventDefault();
                          onStart();
                        }}>
                          <label htmlFor="name">Your name</label>
                          <input id="name" disabled={loading} placeholder={'What is your name?'} className='dialog dialog-option custom-input' type="text" value={name} onInput={(e) => setName(e.target.value)} />
                        </form>
                        <button
                          className='dialogue dialogue-option'
                          onClick={onStart}
                          disabled={loading || name === ''}
                        >
                          <i>Continue</i>
                        </button>
                      </>
                    ) : (
                      <>
                      {
                        optionsWithResponses.map(option =>
                          <button
                            key={option[0]}
                            className='dialogue dialogue-option'
                            disabled={loading}
                            onClick={() => onSubmitPredefinedOption(option)}
                          >
                            {option[0]}
                          </button>
                        )
                      }
                      <form className='dialog dialog-option' onSubmit={(e) => {
                        e.preventDefault();
                        onSubmitCustomOption();
                      }}>
                        <input disabled={loading} placeholder={'Custom option'} className='dialog dialog-option custom-input' type="text" value={customOption} onInput={(e) => setCustomOption(e.target.value)} />
                      </form>
                      <hr />
                      <button
                        className='dialogue dialogue-option reset'
                        disabled={loading}
                        onClick={onClickReset}
                      >
                        Reset game
                      </button>
                    </>
                    )
                  }
                </>
              ) : (
                <p>Please set the environment variable REACT_APP_OPENAI_KEY</p>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
