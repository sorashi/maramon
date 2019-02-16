using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HtmlAgilityPack;
using ShellProgressBar;
using System.Text.RegularExpressions;
using System.Net;
using System.Diagnostics;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;

namespace image_fetcher
{
	class Program
	{
		static Regex r = new Regex(@"/wiki/(.*)_\(.*");
		static List<Error> errors = new List<Error>();
		static Dictionary<string, string> nameExceptionMapping = new Dictionary<string, string>() {
			{ "Farfetch'd", "Farfetch&#39;d"},
			{ "Flabébé", "Red Flower" },
			{ "Floette", "Red Flower" },
			{ "Florges", "Red Flower" },
			{ "Xerneas", "Active Mode" }
		};
		static int Main(string[] args)
		{
			var wc = new WebClient();
			if(!File.Exists("list.txt")) {
				// todo: fetch
				Console.Error.WriteLine("List of Pokemon missing.");
				return 1;
			}
			var lines = File.ReadAllLines("list.txt");
			Console.WriteLine($"image fetcher started, {lines.Length} Pokemon found");
			using(var pbar = new ProgressBar(lines.Length, "Overall progress", ConsoleColor.Yellow)) {
				foreach(var url in lines) {
					if(!r.IsMatch(url)) {
						errors.Add(new Error("???", $"Url not parsed {url}"));
						continue;
					}
					string name = r.Match(url).Groups[1].Value;
					name = WebUtility.UrlDecode(name).Replace('_', ' ');
					pbar.Message = name;
					if(File.Exists(Path.Combine("result", $"{name}.png")) || name == "Type: Null") {
						pbar.Tick();
						continue;
					}
					try{
					var web = new HtmlWeb();
					var doc = web.Load(url);
					var match = doc.DocumentNode.SelectSingleNode($"//img[@alt='{(nameExceptionMapping.ContainsKey(name) ? nameExceptionMapping[name] : name)}'][@srcset]");
					if(match == null) {
						errors.Add(new Error(name, "Could not find image, " + url));
						continue;
					}
					var src = match.GetAttributeValue("src", null);
					if (src == null) {
						errors.Add(new Error(name, "Could not find src"));
						continue;
					}
					wc.DownloadFile("https:" + src, Path.Combine("result", $"{name}.png"));
					}catch(Exception e) {
						while(e is AggregateException) e = e.InnerException;
						errors.Add(new Error(name, e.Message + "\n" + e.StackTrace));
					}
					pbar.Tick();
				}
			}
			Console.WriteLine($"Finished with {errors.Count} errors.");
			foreach(var error in errors) Console.WriteLine(error);
			Console.WriteLine("Hashing phase");
			List<Entry> entries = new List<Entry>();
			var count = Directory.GetFiles("result").Length;
			using(var pbar = new ProgressBar(count, "Hashing", ConsoleColor.Yellow)){
				foreach(var file in Directory.GetFiles("result")){
					pbar.Message = file;
					var psi = new ProcessStartInfo("magick", $"convert -quiet -moments \"{file}\" json:-") {
						RedirectStandardOutput = true
					};
					var p = Process.Start(psi);
					// p.WaitForExit();
					var outp = p.StandardOutput.ReadToEnd()
						.Replace("␍", "").Trim().Replace("nan", "null");
					var jobject = JArray.Parse(outp).Value<JObject>(0);
					var name2 = jobject["image"]["baseName"].ToString();
					var channels = jobject["image"]["channelPerceptualHash"];
					var result = ExtractChannel(channels.Value<JObject>("Channel0") ?? channels.Value<JObject>("redHue"))
						.Concat(ExtractChannel(channels.Value<JObject>("Channel1") ?? channels.Value<JObject>("greenChroma")))
						.Concat(ExtractChannel(channels.Value<JObject>("Channel2") ?? channels.Value<JObject>("blueLuma")))
						.ToArray();
					entries.Add(new Entry() {
						Name = name2.Replace(".png", ""),
						Values = result
					});
					pbar.Tick();
				}
			}
			File.WriteAllText("result.json", JsonConvert.SerializeObject(entries));
			Console.WriteLine("done.");
			return 0;
		}
		static IEnumerable<double> ExtractChannel(JObject channel) {
			return new double[] {
				channel.Value<JArray>("PH1").Value<double>(0),
				channel.Value<JArray>("PH1").Value<double>(1),
				channel.Value<JArray>("PH2").Value<double>(0),
				channel.Value<JArray>("PH2").Value<double>(1),
				channel.Value<JArray>("PH3").Value<double>(0),
				channel.Value<JArray>("PH3").Value<double>(1),
				channel.Value<JArray>("PH4").Value<double>(0),
				channel.Value<JArray>("PH4").Value<double>(1),
				channel.Value<JArray>("PH5").Value<double>(0),
				channel.Value<JArray>("PH5").Value<double>(1),
				channel.Value<JArray>("PH6").Value<double>(0),
				channel.Value<JArray>("PH6").Value<double>(1),
				channel.Value<JArray>("PH7").Value<double>(0),
				channel.Value<JArray>("PH7").Value<double>(1)
			};
		}
	}
[JsonObject]
class Entry {
	[JsonProperty("name")]
	public string Name { get; set; }
	[JsonProperty("phash")]
	public double[] Values {get;set;} 
}
	class Error {
		public Error(string name, string message) {
			PokemonName = name;
			Message = message;
		}
		public string PokemonName {get;set;}
		public string Message{get;set;}
		public override string ToString() {
			return $"[{PokemonName}]: {Message}";
		}
	}
}
