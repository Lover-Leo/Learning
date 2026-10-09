#include<iostream>
#include<limits>
#include<fstream>
#include"cinema.h"
#include"ticket.h"
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
ticket* findticket(std::vector<ticket>& tickets,int newid)
{
    for(auto& ti:tickets)
    {
        if(ti.getid() == newid)
        {
            return &ti;
        }
    }
        return nullptr;
}
void sellingbyid(std::vector<film>& films,std::vector<ticket>& tickets)
{
    int newid;
    int row;
    int column;
    std::cout << "请输入要看的电影场次:";
    std::cin >> newid;
    film* target = findfilm(films,newid);
    std::cout << "请输入几排:";
    std::cin >> row;
    int rowindex = row -1;
    std::cout << "请输入几座:";
    std::cin >> column;
    int columnindex = column - 1;
    std::cout << "请输入您的名字:";
    std::string buyername;
    std::getline(std::cin >> std::ws,buyername);
    if(target == nullptr)
    {
        std::cout << "没有找到该座位\n";
        return;
    }
    if(target->sellseat(rowindex,columnindex))
    {
        tickets.emplace_back(
            (tickets.size() + 1),
            buyername,
            target->getid(),
            rowindex,
            columnindex,
            target->getprice(),
            ticketstatus::valid
        );
        std::cout << "购票成功\n";
        return;
    }
    else
    {
        std::cout << "购票失败\n";
        return;
    }
}
void refundingbyid(std::vector<film>& films,std::vector<ticket>& tickets)
{
    int newid;
    std::cout << "请输入退票的电影票编号:";
    std::cin >> newid;
    ticket* target = findticket(tickets,newid);
    if(target == nullptr)
    {
        std::cout << "没有找到该电影票\n";
        return;
    }
    if (target->getstatus() != ticketstatus::valid)
    {
        std::cout << "该电影票已经退过\n";
        return;
    }
    film* targetfilm = findfilm(films,newid);
    if(targetfilm == nullptr)
    {
        std::cout << "该电影场次不存在\n";
        return;
    } 
    if(!(targetfilm->refundseat(target->getseatrow(),target->getseatcolumn())))
    {
        std::cout << "退票失败\n";
        return;
    }
    target->fundticket();
    std::cout << "退票成功\n";
}
void showticket(std::vector<ticket>& tickets)
{
    int newid;
    std::cout << "请输入电影票编号:";
    std::cin >> newid;
    ticket* target = findticket(tickets,newid);
    if(target == nullptr)
    {
        std::cout << "找不到该电影票\n";
        return;
    }
    else
        target->showinfo();
}
void savedata(const std::vector<film>& films,const std::vector<ticket>& tickets)
{
    std::ofstream outputfilms("film.txt");
    std::ofstream outputtickets("ticket.txt");
    if(!outputfilms || !outputtickets)
    {
        std::cout << "文件未能正常打开\n";
        return;
    }
    for(const auto& fi:films)
    {
        outputfilms << fi.getid() << '\n';
        outputfilms << fi.getname() << '\n';
        outputfilms << fi.gettime() << '\n';
        outputfilms << fi.getcinemaname() << '\n';
        outputfilms << fi.getprice() << '\n';
    }
    for (const auto& ti:tickets)
    {
        outputtickets << ti.getid() << '|';
        outputtickets << ti.getname() << '|';
        outputtickets << ti.getfilmid() << '|';
        outputtickets << ti.getseatrow() << '|';
        outputtickets << ti.getseatcolumn() << '|';
        outputtickets << ti.getprice() << '|';
        outputtickets << static_cast<int>(ti.getstatus()) << '\n';
    }
    
}
void loaddata(std::vector<film>& films,std::vector<ticket>& tickets)
{
    int filmid;
    std::string filmname;
    std::string filmtime;
    std::string cinemaname;
    int filmprice;
    std::vector<std::vector<int>> newseat(5,std::vector<int> (8,seatstatus::availble));
    int ticketid;
    std::string ticketname;
    int ticketfilmid;
    int seatrow;
    int seatcolumn;
    int ticketprice;
    std::string statustext;
    ticketstatus status;
    std::ifstream inputfilms("film.txt");
    std::ifstream inputtickets("ticket.txt");
    while(inputfilms >> filmid)
    {
        if(!(std::getline(inputfilms,filmname))
            ||!(std::getline(inputfilms,filmtime))
            ||!(std::getline(inputfilms,cinemaname))
            ||!(inputfilms >> filmprice)
        )
        {
            std::cout << "电影信息不完整\n";
            return;
        }
         films.emplace_back(filmid,filmname,filmtime,cinemaname,filmprice,newseat);
    }
    while(inputtickets >> ticketid)
    {
        if(!(std::getline(inputtickets,ticketname))
            || !(inputtickets >> ticketfilmid)
            || !(inputtickets >> seatrow)
            || !(inputtickets >> seatcolumn)
            || !(inputtickets >> ticketprice)
            || !(std::getline(inputtickets,statustext))
        )
        {
            std::cout << "电影票信息不完整\n";
            return;
        }
        if(statustext == "0")
        {
            status = ticketstatus::valid;
        }
        else
        {
            status = ticketstatus::funded;
        }
        tickets.emplace_back(ticketid,ticketname,ticketfilmid,seatrow,seatcolumn,ticketprice,status);
    }
}
void resortstatus(std::vector<film>& films,std::vector<ticket>& tickets)
{
    for(auto& ti: tickets)
    {
        if(ti.getstatus() == ticketstatus::valid)
        {
            int newrow = ti.getseatrow();
            int newcolumn = ti.getseatcolumn();
            int filmid = ti.getfilmid();
            for(auto& fi:films)
            {
                if(fi.getid() == filmid)
                {
                    fi.sellseat(newrow,newcolumn);
                }
            }
        }
    }
}
void showstatistics(std::vector<film>& films)
{
    std::cout << "请输入要查询的场次id:";
    int newid = 0;
    std::cin >> newid;
    film* target = findfilm(films,newid);
    if(target == nullptr)
    {
        std::cout << "没有找到该场次\n";
        return;
    }
    std::cout << "该场次的营业额如下:\n";
    std::cout << "总座位数:" << target->gettotalcount() << '\n';
    std::cout << "已售:" << target->getsoldcount() << '\n';
    std::cout << "剩余:" <<target->getremainingcount() << '\n';
    std::cout << "上座率:" << target->getoccupancyrate() << '\n';
    std::cout << "收入:" << target->getevenue() << '\n';
}
int main()
{
    std::vector<std::vector<int>> newseat(5,std::vector<int> (8,seatstatus::availble));
    std::vector<film> films;
    std::vector<ticket> tickets;
    loaddata(films,tickets);
    resortstatus(films,tickets);
    films.emplace_back(1,"生活","11:45","XMUM",14.0f,newseat);
    int choice = -1;
    do
    {
        std::cout << "====电影购票====\n";
        std::cout << "1.显示所有场次信息\n";
        std::cout << "2.根据场次编号进行购票\n";
        std::cout << "3.根据场次编号进行退票\n";
        std::cout << "4.根据场次编号查询营业额\n";
        std::cout << "5.根据电影票编号查询电影票\n";
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
            sellingbyid(films,tickets);
            break;
        case 3:
            refundingbyid(films,tickets);
            break;
        case 4:
            showstatistics(films);
            break;
        case 5:
            showticket(tickets);
            break;
        case 0:
            std::cout << "成功退出系统\n";
            savedata(films,tickets);
            break;
        default:
            std::cout << "输入的数字无效\n";
            break;

       }
       
    } while (choice != 0);
    
    return 0;
}
