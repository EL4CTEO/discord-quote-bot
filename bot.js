const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let quotes = [];
let quotesByAuthor = new Map();

const commands = [
    new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a random inspirational quote'),
    
    new SlashCommandBuilder()
        .setName('dailyquote')
        .setDescription('Get the quote of the day for this server'),
    
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
            option.setName('keywords')
                .setDescription('Keywords to search for (space-separated for multiple)')
                .setRequired(true)
        ),
    
    new SlashCommandBuilder()
        .setName('quotestats')
        .setDescription('Get detailed statistics about the quote collection'),
    
    new SlashCommandBuilder()
        .setName('authorlist')
        .setDescription('Get a paginated list of all authors'),
    
    new SlashCommandBuilder()
        .setName('randomauthor')
        .setDescription('Get a quote from a random author'),
    
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

app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running!', 
        instance: INSTANCE_ID,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        instance: INSTANCE_ID,
        bot: client.isReady() ? 'connected' : 'disconnected',
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        commands: commands.length
    });
});

app.listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
});

if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
        https.get('https://discord-quote-bot-1.onrender.com', (res) => {
            console.log(`Keep-alive ping: ${res.statusCode}`);
        }).on('error', (err) => {
            console.log('Keep-alive ping failed:', err.message);
        });
    }, 14 * 60 * 1000);
}

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

function getDailyQuote(guildId) {
    const today = new Date().toDateString();
    const guildSeed = guildId ? parseInt(guildId.slice(-4), 16) : 0;
    const seed = new Date().getDate() + new Date().getMonth() * 31 + guildSeed;
    const index = seed % quotes.length;
    return quotes[index];
}

function getQuotesByAuthor(author) {
    const authorKey = Array.from(quotesByAuthor.keys()).find(key => 
        key.toLowerCase().includes(author.toLowerCase())
    );
    return authorKey ? { quotes: quotesByAuthor.get(authorKey), exactAuthor: authorKey } : { quotes: [], exactAuthor: null };
}

function searchQuotes(keywords) {
    const keywordArray = keywords.toLowerCase().split(/\s+/);
    return quotes.filter(quote => 
        keywordArray.every(keyword => 
            quote.text.toLowerCase().includes(keyword) ||
            quote.author.toLowerCase().includes(keyword)
        )
    );
}

function findSimilarAuthors(searchTerm, limit = 3) {
    const allAuthors = Array.from(quotesByAuthor.keys());
    return allAuthors
        .filter(author => {
            const authorLower = author.toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            return authorLower.includes(searchLower.slice(0, 3)) || 
                   levenshteinDistance(authorLower, searchLower) <= 3;
        })
        .slice(0, limit);
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

function getMotivationalQuote() {
    const motivationalKeywords = ['success', 'achieve', 'dream', 'goal', 'work', 'future', 'win', 'believe', 'possible', 'great', 'accomplish', 'determination', 'courage', 'strength', 'perseverance', 'effort', 'challenge', 'overcome', 'victory', 'ambition', 'inspire', 'motivate', 'passion', 'dedication'];
    const motivationalAuthors = ['steve jobs', 'disney', 'roosevelt', 'churchill', 'vince lombardi', 'tony robbins', 'zig ziglar', 'napoleon hill'];
    
    const motivationalQuotes = quotes.filter(quote => 
        motivationalKeywords.some(keyword => quote.text.toLowerCase().includes(keyword)) ||
        motivationalAuthors.some(author => quote.author.toLowerCase().includes(author))
    );
    
    return { quotes: motivationalQuotes, count: motivationalQuotes.length };
}

function getWisdomQuote() {
    const wisdomKeywords = ['wisdom', 'learn', 'knowledge', 'understand', 'truth', 'life', 'experience', 'wise', 'teach', 'thinking', 'mind', 'philosophy', 'enlighten', 'insight', 'reflection', 'thought', 'meditation', 'consciousness'];
    const wisdomAuthors = ['plato', 'aristotle', 'confucius', 'gandhi', 'einstein', 'buddha', 'socrates', 'lao tzu', 'seneca', 'marcus aurelius'];
    
    const wisdomQuotes = quotes.filter(quote => 
        wisdomKeywords.some(keyword => quote.text.toLowerCase().includes(keyword)) ||
        wisdomAuthors.some(author => quote.author.toLowerCase().includes(author))
    );
    
    return { quotes: wisdomQuotes, count: wisdomQuotes.length };
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
    
    return { quotes: filteredQuotes, count: filteredQuotes.length };
}

function getQuoteColor(quote) {
    const length = quote.text.length;
    if (length < 50) return 0x2ecc71;
    if (length < 100) return 0x3498db;
    if (length < 150) return 0x9b59b6;
    return 0xe74c3c;
}

function createQuoteEmbed(quote, title = '💬 Inspirational Quote', extraFooter = '') {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`*"${quote.text}"*`)
        .addFields({ name: 'Author', value: `**${quote.author}**`, inline: true })
        .setColor(getQuoteColor(quote))
        .setFooter({ text: `${quote.length} characters${extraFooter}` })
        .setTimestamp();
    
    return embed;
}

function createAuthorListEmbed(authors, page, totalPages) {
    const start = page * 20;
    const end = Math.min(start + 20, authors.length);
    const pageAuthors = authors.slice(start, end);
    
    const authorList = pageAuthors.map((author, idx) => {
        const count = quotesByAuthor.get(author).length;
        return `${start + idx + 1}. **${author}** (${count} quote${count > 1 ? 's' : ''})`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle('👥 Authors in Collection')
        .setDescription(authorList)
        .setColor(0x9b59b6)
        .setFooter({ text: `Page ${page + 1} of ${totalPages} • Total: ${authors.length} authors` })
        .setTimestamp();
    
    return embed;
}

function createPaginationButtons(page, totalPages, customId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`${customId}_first`)
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`${customId}_prev`)
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`${customId}_next`)
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
                .setCustomId(`${customId}_last`)
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        );
    
    return row;
}

client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    console.log(`🔗 Connected to ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);
    loadQuotes();
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    
    try {
        console.log('🔍 Checking for existing commands...');
        
        const existingCommands = await rest.get(Routes.applicationCommands(client.user.id));
        console.log(`Found ${existingCommands.length} existing commands`);
        
        const currentCommandNames = commands.map(cmd => cmd.name).sort();
        const existingCommandNames = existingCommands.map(cmd => cmd.name).sort();
        
        const isDifferent = JSON.stringify(currentCommandNames) !== JSON.stringify(existingCommandNames);
        const hasDuplicates = existingCommands.length !== new Set(existingCommandNames).size;
        
        if (isDifferent || hasDuplicates) {
            console.log('🧹 Commands are different or duplicated - clearing and re-registering...');
            
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            console.log('✅ Cleared all existing commands');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log('✨ Registered fresh commands successfully!');
        } else {
            console.log('✅ Commands are already up to date - no action needed');
        }
        
        const finalCommands = await rest.get(Routes.applicationCommands(client.user.id));
        console.log(`🎯 Final command count: ${finalCommands.length}`);
        console.log(`📝 Commands: ${finalCommands.map(cmd => cmd.name).join(', ')}`);
        
    } catch (error) {
        console.error('❌ Error managing commands:', error);
        console.log('🔄 Attempting fallback registration...');
        try {
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log('✅ Fallback registration successful');
        } catch (fallbackError) {
            console.error('❌ Fallback failed:', fallbackError);
        }
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
                    const daily = getDailyQuote(interaction.guildId);
                    if (daily) {
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(daily, '🌅 Daily Quote for This Server', ' • Unique to this server')] 
                        });
                    } else {
                        await interaction.reply('❌ No daily quote available.');
                    }
                    break;

                case 'quotebyauthor':
                    const authorSearch = interaction.options.getString('author');
                    const { quotes: authorQuotes, exactAuthor } = getQuotesByAuthor(authorSearch);
                    
                    if (authorQuotes.length > 0) {
                        const randomAuthorQuote = authorQuotes[Math.floor(Math.random() * authorQuotes.length)];
                        const footerText = ` • ${exactAuthor} has ${authorQuotes.length} quote${authorQuotes.length > 1 ? 's' : ''} in collection`;
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(randomAuthorQuote, `📖 Quote by ${exactAuthor}`, footerText)] 
                        });
                    } else {
                        const suggestions = findSimilarAuthors(authorSearch);
                        let reply = `❌ No quotes found for author: "${authorSearch}"`;
                        if (suggestions.length > 0) {
                            reply += `\n\n💡 Did you mean: ${suggestions.join(', ')}?`;
                        }
                        await interaction.reply(reply);
                    }
                    break;

                case 'searchquote':
                    const keywords = interaction.options.getString('keywords');
                    const searchResults = searchQuotes(keywords);
                    
                    if (searchResults.length > 0) {
                        const randomResult = searchResults[Math.floor(Math.random() * searchResults.length)];
                        const footerText = ` • Found ${searchResults.length} matching quote${searchResults.length > 1 ? 's' : ''}`;
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(randomResult, `🔍 Quote containing "${keywords}"`, footerText)] 
                        });
                    } else {
                        await interaction.reply(`❌ No quotes found containing: "${keywords}"\n\n💡 Try using fewer or different keywords.`);
                    }
                    break;

                case 'quotestats':
                    const topAuthors = Array.from(quotesByAuthor.entries())
                        .sort((a, b) => b[1].length - a[1].length)
                        .slice(0, 5);
                    
                    const avgLength = Math.round(quotes.reduce((sum, q) => sum + q.length, 0) / quotes.length);
                    const shortest = quotes.reduce((min, q) => q.length < min.length ? q : min);
                    const longest = quotes.reduce((max, q) => q.length > max.length ? q : max);
                    
                    const statsEmbed = new EmbedBuilder()
                        .setTitle('📊 Quote Collection Statistics')
                        .addFields(
                            { name: 'Total Quotes', value: quotes.length.toString(), inline: true },
                            { name: 'Total Authors', value: quotesByAuthor.size.toString(), inline: true },
                            { name: 'Average Length', value: `${avgLength} characters`, inline: true },
                            { name: 'Shortest Quote', value: `${shortest.length} chars by ${shortest.author}`, inline: true },
                            { name: 'Longest Quote', value: `${longest.length} chars by ${longest.author}`, inline: true },
                            { name: '\u200B', value: '\u200B', inline: true },
                            { name: '🏆 Top 5 Authors', value: topAuthors.map((author, index) => `${index + 1}. **${author[0]}** (${author[1].length} quotes)`).join('\n'), inline: false }
                        )
                        .setColor(0xe74c3c)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [statsEmbed] });
                    break;

                case 'authorlist':
                    const authors = Array.from(quotesByAuthor.keys()).sort();
                    const totalPages = Math.ceil(authors.length / 20);
                    const page = 0;
                    
                    const embed = createAuthorListEmbed(authors, page, totalPages);
                    const buttons = createPaginationButtons(page, totalPages, 'authorlist');
                    
                    await interaction.reply({ 
                        embeds: [embed], 
                        components: totalPages > 1 ? [buttons] : [] 
                    });
                    break;

                case 'randomauthor':
                    const randomAuthor = Array.from(quotesByAuthor.keys())[Math.floor(Math.random() * quotesByAuthor.size)];
                    const randomAuthorQuotes = quotesByAuthor.get(randomAuthor);
                    const randomQuoteFromAuthor = randomAuthorQuotes[Math.floor(Math.random() * randomAuthorQuotes.length)];
                    const footerText = ` • ${randomAuthor} has ${randomAuthorQuotes.length} quote${randomAuthorQuotes.length > 1 ? 's' : ''} in collection`;
                    
                    await interaction.reply({ 
                        embeds: [createQuoteEmbed(randomQuoteFromAuthor, `🎲 Random quote by ${randomAuthor}`, footerText)] 
                    });
                    break;

                case 'motivational':
                    const { quotes: motivationalQuotes, count: motCount } = getMotivationalQuote();
                    if (motivationalQuotes.length > 0) {
                        const motivational = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
                        const footerText = ` • ${motCount} motivational quotes available`;
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(motivational, '💪 Motivational Quote', footerText)] 
                        });
                    } else {
                        const fallback = getRandomQuote();
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(fallback, '💪 Motivational Quote', ' • Showing random quote')] 
                        });
                    }
                    break;

                case 'wisdom':
                    const { quotes: wisdomQuotes, count: wisCount } = getWisdomQuote();
                    if (wisdomQuotes.length > 0) {
                        const wisdom = wisdomQuotes[Math.floor(Math.random() * wisdomQuotes.length)];
                        const footerText = ` • ${wisCount} wisdom quotes available`;
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(wisdom, '🧠 Wisdom Quote', footerText)] 
                        });
                    } else {
                        const fallback = getRandomQuote();
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(fallback, '🧠 Wisdom Quote', ' • Showing random quote')] 
                        });
                    }
                    break;

                case 'quotelength':
                    const lengthType = interaction.options.getString('length');
                    const { quotes: lengthQuotes, count: lengthCount } = getQuotesByLength(lengthType);
                    
                    if (lengthQuotes.length > 0) {
                        const lengthQuote = lengthQuotes[Math.floor(Math.random() * lengthQuotes.length)];
                        const lengthTitle = `📏 ${lengthType.charAt(0).toUpperCase() + lengthType.slice(1)} Quote`;
                        const footerText = ` • ${lengthCount} ${lengthType} quotes available`;
                        await interaction.reply({ 
                            embeds: [createQuoteEmbed(lengthQuote, lengthTitle, footerText)] 
                        });
                    } else {
                        await interaction.reply(`❌ No ${lengthType} quotes found in the collection.`);
                    }
                    break;
            }
        } catch (error) {
            console.error('Command error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true });
            }
        }
    } else if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'quotebyauthor') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const allAuthors = Array.from(quotesByAuthor.keys());
            
            const exactMatches = allAuthors.filter(author => 
                author.toLowerCase().startsWith(focusedValue)
            ).sort();
            
            const partialMatches = allAuthors.filter(author => 
                !author.toLowerCase().startsWith(focusedValue) &&
                author.toLowerCase().includes(focusedValue)
            ).sort();
            
            const sortedByQuoteCount = allAuthors
                .filter(author => !exactMatches.includes(author) && !partialMatches.includes(author))
                .sort((a, b) => quotesByAuthor.get(b).length - quotesByAuthor.get(a).length);
            
            const combinedResults = [...exactMatches, ...partialMatches, ...sortedByQuoteCount].slice(0, 25);
            
            await interaction.respond(
                combinedResults.map(author => {
                    const count = quotesByAuthor.get(author).length;
                    return { 
                        name: `${author} (${count} quote${count > 1 ? 's' : ''})`, 
                        value: author 
                    };
                })
            );
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('authorlist_')) {
            const authors = Array.from(quotesByAuthor.keys()).sort();
            const totalPages = Math.ceil(authors.length / 20);
            
            const currentEmbed = interaction.message.embeds[0];
            const currentPageMatch = currentEmbed.footer.text.match(/Page (\d+) of (\d+)/);
            let currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) - 1 : 0;
            
            const action = interaction.customId.split('_')[1];
            
            switch (action) {
                case 'first':
                    currentPage = 0;
                    break;
                case 'prev':
                    currentPage = Math.max(0, currentPage - 1);
                    break;
                case 'next':
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                    break;
                case 'last':
                    currentPage = totalPages - 1;
                    break;
            }
            
            const newEmbed = createAuthorListEmbed(authors, currentPage, totalPages);
            const newButtons = createPaginationButtons(currentPage, totalPages, 'authorlist');
            
            await interaction.update({ 
                embeds: [newEmbed], 
                components: [newButtons] 
            });
        }
    }
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
    console.error('Client error:', error);
});

client.on('disconnect', () => {
    console.log('🔌 Bot disconnected');
});

client.on('reconnecting', () => {
    console.log('🔄 Bot reconnecting...');
});

client.login(process.env.BOT_TOKEN);
