#include<iostream>
#include<string>
#include<vector>
#include<limits>
#include<fstream>
enum seatstatus
{
    availble = 0,
    sold = 1
};
class film
{
    private:
        int id;
        std::string name;
        std::string time;
        std::string cinemaname;
        float price;
        std::vector<std::vector<int>> seat;

    public:
        film(
            const int newid,
            const std::string& newname,
            const std::string& newtime,
            const std::string& newcinemaname,
            float newprice,
            const std::vector<std::vector<int>>& newseat
        );
        int getid() const;
        const std::string& getname() const;
        const std::string& gettime() const;
        const std::string& getcinemaname() const;
        float getprice() const;
        void showinfo() const;
        void showseat() const;
        bool isseatvalid(int row,int column) const;
        bool sellseat(int row,int column);
};
film::film(
    const int newid,
    const std::string& newname,
    const std::string& newtime,
    const std::string& newcinemaname,
    float newprice,
    const std::vector<std::vector<int>>& newseat
):id(newid),name(newname),time(newtime),cinemaname(newcinemaname),price(newprice),seat(newseat)
{
};
int film::getid() const
{
    return id;
}
const std::string& film::getname() const
{
    return name;
}
const std::string& film::gettime() const
{
    return time;
}
const std::string& film::getcinemaname() const
{
    return cinemaname;
}
float film::getprice() const
{
    return price;
}
void film::showinfo() const
{
    std::cout << "场次编号:" << id << '\n';
    std::cout << "电影名称:" << name <<'\n';
    std::cout << "放映时间:" << time <<'\n';
    std::cout << "票价:" << price << '\n';
    std::cout << "影院名称:" << cinemaname << '\n';
    std::cout << "当前座位:\n";
    showseat();
}
void film::showseat() const
{
    int row = 0;
    int column = 0;
    for(row = 0;row < seat.size();row++)
    {
        for(column = 0;column < seat[row].size();column++)
        {
            if(seat[row][column] == seatstatus::availble)
            {
                std::cout << 'O';
            }
            else
            {
                std::cout << 'X';
            }
        }
        std::cout << '\n';
    }
}
bool film::isseatvalid(int row,int column) const
{
    if(row < 0 || 
        row >= seat.size() || 
        column < 0 ||
        column >= seat[0].size()
    )
    {
        std::cout << "该座位不合法\n";
        return false;
    }
    else
        return true;
}
bool film::sellseat(int row,int column)
{
    if(isseatvalid(row,column))
    {
        if(seat[row][column] == seatstatus::sold)
        {
            return false;
        }
        else
        {
            seat[row][column] = seatstatus::sold;
            return true;
        }
    }
    else
        return false;
}
void showallfilm(const std::vector<film>& films)
{
    if(films.empty())
    {
        std::cout << "当前没有电影场次\n";
        return;
    }
    for(const auto& fi:films)
    {
        fi.showinfo();
    }
}
film* findfilm(std::vector<film>& films,int newid)
{
    for(auto& fi:films)
    {
        if(fi.getid() == newid)
        {
            return &fi;
        }
    }
        return nullptr;
}
void sellingbyid(std::vector<film>& films)
{
    int newid;
    int row;
    int column;
    std::cout << "请输入要看的电影场次:";
    std::cin >> newid;
    film* target = findfilm(films,newid);
    std::cout << "请输入几排:";
    std::cin >> row;
    std::cout << "请输入几座:";
    std::cin >> column;
    if(target == nullptr)
    {
        std::cout << "没有找到该座位\n";
        return;
    }
    if(target->sellseat(row-1,column-1))
    {
        std::cout << "购票成功\n";
        return;
    }
    else
    {
        std::cout << "购票失败\n";
        return;
    }
}
int main()
{
    std::vector<std::vector<int>> newseat(5,std::vector<int> (8,seatstatus::availble));
    std::vector<film> films;
    films.emplace_back(1,"生活","11:45","XMUM",14.0f,newseat);
    int choice = -1;
    do
    {
        std::cout << "====电影购票====\n";
        std::cout << "1.显示所有场次信息\n";
        std::cout << "2.根据场次编号进行购票\n";
        std::cout << "0.退出系统\n";
        if(!(std::cin >> choice))
        {
            std::cin.clear();
            std::cin.ignore(    
                (std::numeric_limits<std::streamsize>::max)(),
                '\n'
            );
            choice = -1;
            continue;
        }
       switch (choice)
       {
        case 1:
            showallfilm(films);
            break;
        case 2:
            sellingbyid(films);
            break;
        case 0:
            std::cout << "成功退出系统\n";
            break;
        default:
            std::cout << "输入的数字无效\n";
            break;

       }
       
    } while (choice != 0);
    
    return 0;
}
