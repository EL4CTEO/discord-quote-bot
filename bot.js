const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running!', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        bot: client.isReady() ? 'connected' : 'disconnected',
        guilds: client.guilds.cache.size,
        users: client.users.cache.size
    });
});

app.listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let quotes = [];
let quotesByAuthor = new Map();
let dailyQuote = null;
let lastDailyQuoteDate = null;

const commands = [
    new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a random inspirational quote'),
    
    new SlashCommandBuilder()
        .setName('dailyquote')
        .setDescription('Get the quote of the day'),
    
    new SlashCommandBuilder()
        .setName('quotebyauthor')
        .setDescription('Get a random quote by a specific author')
        .addStringOption(option => 
            option.setName('author')
                .setDescription('Author name')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    new SlashCommandBuilder()
        .setName('searchquote')
        .setDescription('Search for quotes containing specific words')
        .addStringOption(option => 
            option.setName('keyword')
                .setDescription('Keyword to search for')
                .setRequired(true)
        ),
    
    new SlashCommandBuilder()
        .setName('quotestats')
        .setDescription('Get statistics about the quote collection'),
    
    new SlashCommandBuilder()
        .setName('authorlist')
        .setDescription('Get a list of all authors in the collection'),
    
    new SlashCommandBuilder()
        .setName('randomauthor')
        .setDescription('Get all quotes from a random author'),
    
    new SlashCommandBuilder()
        .setName('motivational')
        .setDescription('Get a motivational quote'),
    
    new SlashCommandBuilder()
        .setName('wisdom')
        .setDescription('Get a wisdom quote'),    
    new SlashCommandBuilder()
        .setName('quotelength')
        .setDescription('Get quotes by length preference')
        .addStringOption(option =>
            option.setName('length')
                .setDescription('Quote length preference')
                .setRequired(true)
                .addChoices(
                    { name: 'Short (under 50 characters)', value: 'short' },
                    { name: 'Medium (50-150 characters)', value: 'medium' },
                    { name: 'Long (over 150 characters)', value: 'long' }
                )
        )
];

function loadQuotes() {
    try {
        const quotesPath = path.join(__dirname, 'quotes.txt');
        const data = fs.readFileSync(quotesPath, 'utf8');
        const lines = data.split('\n');
        
        quotes = [];
        quotesByAuthor.clear();
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line && line.includes(' - ') && !line.startsWith('- ')) {
                const quote = line.trim();
                const lastDashIndex = quote.lastIndexOf(' - ');
                
                if (lastDashIndex > 0) {
                    const text = quote.substring(0, lastDashIndex).trim();
                    let author = quote.substring(lastDashIndex + 3).trim();
                    
                    if (text.length > 5 && author.length > 0) {
                        const cleanText = text.replace(/^"|"$/g, '');
                        
                        const quoteObj = {
                            text: cleanText,
                            author: author,
                            length: cleanText.length
                        };
                        
                        quotes.push(quoteObj);
                        
                        if (!quotesByAuthor.has(author)) {
                            quotesByAuthor.set(author, []);
                        }
                        quotesByAuthor.get(author).push(quoteObj);
                    }
                }
            }
        }
        
        console.log(`📚 Loaded ${quotes.length} quotes from ${quotesByAuthor.size} authors`);
        
    } catch (error) {
        console.error('Error loading quotes:', error);
    }
}
function getRandomQuote() {
    if (quotes.length === 0) return null;
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function getDailyQuote() {
    const today = new Date().toDateString();
    
    if (lastDailyQuoteDate !== today || !dailyQuote) {
        const seed = new Date().getDate() + new Date().getMonth() * 31;
        const index = seed % quotes.length;
        dailyQuote = quotes[index];
        lastDailyQuoteDate = today;
    }
    
    return dailyQuote;
}

function getQuotesByAuthor(author) {
    const authorKey = Array.from(quotesByAuthor.keys()).find(key => 
        key.toLowerCase().includes(author.toLowerCase())
    );
    return authorKey ? quotesByAuthor.get(authorKey) : [];
}

function searchQuotes(keyword) {
    return quotes.filter(quote => 
        quote.text.toLowerCase().includes(keyword.toLowerCase()) ||
        quote.author.toLowerCase().includes(keyword.toLowerCase())
    );
}

function getMotivationalQuote() {
    const motivationalKeywords = ['success', 'achieve', 'dream', 'goal', 'work', 'future', 'win', 'believe', 'possible'];
    const motivationalQuotes = quotes.filter(quote => 
        motivationalKeywords.some(keyword => 
            quote.text.toLowerCase().includes(keyword) || 
            quote.author.toLowerCase().includes('steve jobs') ||
            quote.author.toLowerCase().includes('disney')
        )
    );
    
    if (motivationalQuotes.length > 0) {
        return motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    }
    return getRandomQuote();
}

function getWisdomQuote() {
    const wisdomKeywords = ['wisdom', 'learn', 'knowledge', 'understand', 'truth', 'life', 'experience'];
    const wisdomAuthors = ['plato', 'aristotle', 'confucius', 'gandhi', 'einstein', 'buddha'];
    
    const wisdomQuotes = quotes.filter(quote => 
        wisdomKeywords.some(keyword => quote.text.toLowerCase().includes(keyword)) ||
        wisdomAuthors.some(author => quote.author.toLowerCase().includes(author))
    );
    
    if (wisdomQuotes.length > 0) {
        return wisdomQuotes[Math.floor(Math.random() * wisdomQuotes.length)];
    }
    return getRandomQuote();
}
function getQuotesByLength(lengthType) {
    let filteredQuotes;
    
    switch (lengthType) {
        case 'short':
            filteredQuotes = quotes.filter(quote => quote.length < 50);
            break;
        case 'medium':
            filteredQuotes = quotes.filter(quote => quote.length >= 50 && quote.length <= 150);
            break;
        case 'long':
            filteredQuotes = quotes.filter(quote => quote.length > 150);
            break;
        default:
            filteredQuotes = quotes;
    }
    
    if (filteredQuotes.length > 0) {
        return filteredQuotes[Math.floor(Math.random() * filteredQuotes.length)];
    }
    return getRandomQuote();
}

function createQuoteEmbed(quote, title = '💬 Inspirational Quote') {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`*"${quote.text}"*`)
        .addFields({ name: 'Author', value: `**${quote.author}**`, inline: true })
        .setColor(0x3498db)
        .setFooter({ text: `Quote ${quotes.indexOf(quote) + 1} of ${quotes.length}` })
        .setTimestamp();
    
    return embed;
}

client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    loadQuotes();
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        console.log('🧹 Clearing old commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        
        console.log('📝 Registering new quote commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✨ Quote Bot is ready with all commands!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        try {
            switch (interaction.commandName) {
                case 'quote':
                    const randomQuote = getRandomQuote();
                    if (randomQuote) {
                        await interaction.reply({ embeds: [createQuoteEmbed(randomQuote)] });
                    } else {
                        await interaction.reply('❌ No quotes available at the moment.');
                    }
                    break;

                case 'dailyquote':
                    const daily = getDailyQuote();
                    if (daily) {
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(daily, '🌅 Daily Quote')] 
                        });
                    } else {
                        await interaction.reply('❌ No daily quote available.');
                    }
                    break;

                case 'quotebyauthor':
                    const author = interaction.options.getString('author');
                    const authorQuotes = getQuotesByAuthor(author);
                    if (authorQuotes.length > 0) {
                        const randomAuthorQuote = authorQuotes[Math.floor(Math.random() * authorQuotes.length)];
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(randomAuthorQuote, `📖 Quote by ${randomAuthorQuote.author}`)] 
                        });
                    } else {
                        await interaction.reply(`❌ No quotes found for author: "${author}"`);
                    }
                    break;

                case 'searchquote':
                    const keyword = interaction.options.getString('keyword');
                    const searchResults = searchQuotes(keyword);
                    if (searchResults.length > 0) {
                        const randomResult = searchResults[Math.floor(Math.random() * searchResults.length)];
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(randomResult, `🔍 Quote containing "${keyword}"`)] 
                        });
                    } else {
                        await interaction.reply(`❌ No quotes found containing: "${keyword}"`);
                    }
                    break;
                case 'quotestats':
                    const topAuthors = Array.from(quotesByAuthor.entries())
                        .sort((a, b) => b[1].length - a[1].length)
                        .slice(0, 5);
                    
                    const statsEmbed = new EmbedBuilder()
                        .setTitle('📊 Quote Collection Statistics')
                        .addFields(
                            { name: 'Total Quotes', value: quotes.length.toString(), inline: true },
                            { name: 'Total Authors', value: quotesByAuthor.size.toString(), inline: true },
                            { name: 'Average Quote Length', value: Math.round(quotes.reduce((sum, q) => sum + q.length, 0) / quotes.length) + ' characters', inline: true },
                            { name: 'Top Authors', value: topAuthors.map((author, index) => `${index + 1}. ${author[0]} (${author[1].length} quotes)`).join('\n'), inline: false }
                        )
                        .setColor(0xe74c3c);
                    
                    await interaction.reply({ embeds: [statsEmbed] });
                    break;

                case 'authorlist':
                    const authors = Array.from(quotesByAuthor.keys()).sort();
                    const authorChunks = [];
                    for (let i = 0; i < authors.length; i += 20) {
                        authorChunks.push(authors.slice(i, i + 20));
                    }
                    
                    const authorEmbed = new EmbedBuilder()
                        .setTitle('👥 Authors in Collection')
                        .setDescription(authorChunks[0].join('\n'))
                        .setColor(0x9b59b6)
                        .setFooter({ text: `Showing 1-${Math.min(20, authors.length)} of ${authors.length} authors` });
                    
                    await interaction.reply({ embeds: [authorEmbed] });
                    break;

                case 'randomauthor':
                    const randomAuthor = Array.from(quotesByAuthor.keys())[Math.floor(Math.random() * quotesByAuthor.size)];
                    const randomAuthorQuotes = quotesByAuthor.get(randomAuthor);
                    const randomQuoteFromAuthor = randomAuthorQuotes[Math.floor(Math.random() * randomAuthorQuotes.length)];
                    
                    await interaction.reply({ 
                        embeds: [createQuoteEmbed(randomQuoteFromAuthor, `🎲 Random quote by ${randomAuthor}`)] 
                    });
                    break;

                case 'motivational':
                    const motivational = getMotivationalQuote();
                    await interaction.reply({ 
                        embeds: [createQuoteEmbed(motivational, '💪 Motivational Quote')] 
                    });
                    break;

                case 'wisdom':
                    const wisdom = getWisdomQuote();
                    await interaction.reply({ 
                        embeds: [createQuoteEmbed(wisdom, '🧠 Wisdom Quote')] 
                    });
                    break;
                case 'quotelength':
                    const lengthType = interaction.options.getString('length');
                    const lengthQuote = getQuotesByLength(lengthType);
                    const lengthTitle = `📏 ${lengthType.charAt(0).toUpperCase() + lengthType.slice(1)} Quote`;
                    await interaction.reply({ 
                        embeds: [createQuoteEmbed(lengthQuote, lengthTitle)] 
                    });
                    break;
            }
        } catch (error) {
            console.error('Command error:', error);
            if (!interaction.replied) {
                await interaction.reply('❌ An error occurred while processing your request.');
            }
        }
    } else if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'quotebyauthor') {
            const focusedValue = interaction.options.getFocused();
            const authors = Array.from(quotesByAuthor.keys())
                .filter(author => author.toLowerCase().includes(focusedValue.toLowerCase()))
                .slice(0, 25);
            
            await interaction.respond(
                authors.map(author => ({ name: author, value: author }))
            );
        }
    }
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.login(process.env.BOT_TOKEN);